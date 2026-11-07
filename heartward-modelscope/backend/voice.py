"""Bounded ASR/TTS adapters. Audio stays in memory; credentials stay server-side."""
import base64
import binascii
import io
import os
import threading
import urllib.parse
import urllib.request
import wave

from .companion import api_key, _json_request, provider_reason
from . import provider_state

MAX_AUDIO = 1_000_000
MAX_OUTPUT = 8 * 1024 * 1024
slots = threading.BoundedSemaphore(2)


class VoiceError(Exception):
    def __init__(self, message, reason="service_unavailable", status=503):
        super().__init__(message)
        self.reason = reason
        self.status = status


def voice_key():
    return os.getenv("PET_VOICE_API_KEY") or api_key()


def _check(kind):
    if not voice_key():
        raise VoiceError("尚未配置语音服务，可以继续打字聊天。", "no_key")
    if not provider_state.available(kind):
        state = provider_state.status(kind)
        raise VoiceError(_error_message(state["reason"]), state["reason"])
    if not slots.acquire(blocking=False):
        raise VoiceError("语音服务正在忙，请稍后再试。", "busy", 429)


def _error_message(reason):
    return {
        "billing": "百炼语音服务计费状态异常，请检查账户；仍可打字聊天。",
        "auth": "语音服务鉴权失败，请检查 Key 和接口地域；仍可打字聊天。",
    }.get(reason, "语音服务暂不可用，请重试；仍可打字聊天。")


def _failure(kind, error):
    reason = provider_reason(error)
    provider_state.failure(kind, reason)
    return VoiceError(_error_message(reason), reason)


def _wav(raw):
    try:
        with wave.open(io.BytesIO(raw), "rb") as audio:
            frames = audio.getnframes()
            rate = audio.getframerate()
            channels = audio.getnchannels()
            width = audio.getsampwidth()
            if (audio.getcomptype() != "NONE" or width != 2 or channels != 1
                    or rate != 16000 or not 0.3 <= frames / rate <= 15.1):
                raise ValueError("请录制 0.3～15 秒的 16 kHz 单声道 PCM16 WAV。")
            if len(audio.readframes(frames)) != frames * channels * width:
                raise ValueError("录音内容不完整，请重新录制。")
    except (wave.Error, EOFError, OSError):
        raise ValueError("录音格式无效，请重新录制。") from None


def transcribe(data):
    if not isinstance(data, dict) or data.get("mime_type") != "audio/wav":
        raise ValueError("语音输入必须为 WAV 录音。")
    encoded = data.get("audio_base64")
    if not isinstance(encoded, str) or len(encoded) > MAX_AUDIO * 4 // 3 + 4:
        raise ValueError("录音过大，请缩短到 15 秒以内。")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise ValueError("录音编码无效。") from None
    if not 44 < len(raw) <= MAX_AUDIO:
        raise ValueError("录音大小无效。")
    _wav(raw)
    _check("asr")
    try:
        payload = {
            "model": os.getenv("PET_ASR_MODEL", "qwen3-asr-flash"),
            "messages": [{"role": "user", "content": [{"type": "input_audio", "input_audio": {
                "data": "data:audio/wav;base64," + encoded}}]}],
            "stream": False, "asr_options": {"enable_itn": True},
        }
        result = _json_request(os.getenv("PET_ASR_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"),
                               payload, voice_key(), 35)
        text = result["choices"][0]["message"]["content"]
        if not isinstance(text, str) or len(text.strip()) > 500:
            raise ValueError("invalid_transcript")
        provider_state.success("asr")
        if not text.strip():
            raise VoiceError("没有识别到说话内容，请靠近麦克风再试。", "no_speech", 422)
        return {"text": text.strip(), "source": "qwen_asr"}
    except VoiceError:
        raise
    except (OSError, ValueError, KeyError, TypeError, IndexError) as error:
        raise _failure("asr", error) from None
    finally:
        slots.release()


def _download_url(url):
    # Only a URL from the authenticated provider result is accepted, never a client URL.
    # Official examples may return an HTTP OSS URL; upgrade it before downloading.
    parsed = urllib.parse.urlsplit(url)
    host = parsed.hostname or ""
    if (parsed.scheme not in ("http", "https") or parsed.username or parsed.password
            or parsed.port not in (None, 80, 443) or not host.endswith(".aliyuncs.com")):
        raise ValueError("invalid_audio_url")
    return urllib.parse.urlunsplit(("https", host, parsed.path, parsed.query, ""))


def normalize_output(raw):
    """Rebuild provider WAVs whose streaming header has an oversized placeholder."""
    with wave.open(io.BytesIO(raw), "rb") as audio:
        channels, width, rate = audio.getnchannels(), audio.getsampwidth(), audio.getframerate()
        declared = audio.getnframes() * channels * width
        pcm = audio.readframes(audio.getnframes())
        placeholder = declared > MAX_OUTPUT and int.from_bytes(raw[4:8], "little") >= 0x7fff0000
        if (audio.getcomptype() != "NONE" or width != 2 or channels not in (1, 2)
                or not 8000 <= rate <= 48000 or len(pcm) % (channels * width)
                or not 0 < len(pcm) / (rate * channels * width) <= 90
                or (len(pcm) != declared and not placeholder)):
            raise ValueError("invalid_audio")
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(channels)
        audio.setsampwidth(width)
        audio.setframerate(rate)
        audio.writeframes(pcm)
    return output.getvalue()


def synthesize(data):
    text = data.get("text") if isinstance(data, dict) else None
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= 240:
        raise ValueError("朗读文本需要 1 到 240 个字符。")
    _check("tts")
    try:
        payload = {"model": os.getenv("PET_TTS_MODEL", "qwen3-tts-flash"), "input": {
            "text": text.strip(), "voice": os.getenv("PET_TTS_VOICE", "Cherry"), "language_type": "Auto"}}
        result = _json_request(os.getenv("PET_TTS_URL", "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"),
                               payload, voice_key(), 35)
        with urllib.request.urlopen(_download_url(result["output"]["audio"]["url"]), timeout=15) as response:
            raw = response.read(MAX_OUTPUT + 1)
        if len(raw) > MAX_OUTPUT:
            raise ValueError("audio_too_large")
        raw = normalize_output(raw)
        provider_state.success("tts")
        return raw
    except (OSError, ValueError, KeyError, TypeError, IndexError, wave.Error, EOFError) as error:
        raise _failure("tts", error) from None
    finally:
        slots.release()
