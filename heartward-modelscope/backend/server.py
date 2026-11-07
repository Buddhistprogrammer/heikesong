import json
import os
import socket
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from .config import ReloadableEnv

CONFIG = ReloadableEnv()
CONFIG.reload()

from .compiler import compile_wish, make_story
from .companion import api_key, create_pet, get_pet, pet_image, latest_pet, chat
from .content import CONTENT
from . import provider_state
from . import execution
from . import voice
from . import API_VERSION, WORKSPACE_ID


dreams = {}
lock = threading.Lock()
WEB_ROOT = Path(__file__).resolve().parent.parent / "web"
STATIC_TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
                ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".wav": "audio/wav",
                ".ico": "image/x-icon", ".mp4": "video/mp4"}


def make_card(ident, dream):
    return {"postcard_id": ident, "title": dream["title"], "description": dream["desc"],
            "story": make_story(dream), "palette": dream["palette"], "message": dream["tail_line"],
            "label": "AI 辅助创作的虚拟场景"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def respond(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, path):
        """Serve only the checked-in web directory; never expose .env or project files."""
        raw = unquote(path)
        relative = raw[1:] if raw.startswith("/") else raw
        if relative in ("", "index.html"):
            relative = "index.html"
        if "\x00" in relative or any(part in ("", ".", "..") for part in Path(relative).parts):
            return False
        candidate = (WEB_ROOT / relative).resolve()
        try:
            candidate.relative_to(WEB_ROOT.resolve())
        except ValueError:
            return False
        if not candidate.is_file() or candidate.suffix.lower() not in STATIC_TYPES:
            return False
        body = candidate.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", STATIC_TYPES[candidate.suffix.lower()])
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)
        return True

    def do_POST(self):
        CONFIG.reload(provider_state.reset)
        path = urlsplit(self.path).path
        if path in ("/api/voice/transcribe", "/api/voice/synthesize"):
            try:
                size = int(self.headers.get("Content-Length", "0"))
                limit = 1_400_000 if path.endswith("transcribe") else 4096
                if not 0 < size <= limit:
                    raise ValueError("语音请求大小无效。")
                data = json.loads(self.rfile.read(size))
                if path.endswith("transcribe"):
                    return self.respond(200, voice.transcribe(data))
                raw = voice.synthesize(data)
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(len(raw)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return self.wfile.write(raw)
            except voice.VoiceError as error:
                return self.respond(error.status, {"error": str(error), "reason": error.reason})
            except (ValueError, UnicodeError) as error:
                return self.respond(400, {"error": str(error)})
        if path in ("/api/pets", "/api/chat", "/pet/generate", "/chat/next", "/scene/switch", "/culture/info", "/api/culture/info"):
            try:
                size = int(self.headers.get("Content-Length", "0"))
                limit = 7_100_000 if path in ("/api/pets", "/pet/generate") else 16384
                if not 0 < size <= limit:
                    raise ValueError("请求过大或为空。")
                data = json.loads(self.rfile.read(size))
                if path == "/scene/switch":
                    return self.respond(200, execution.switch_scene(data))
                if path in ("/culture/info", "/api/culture/info"):
                    return self.respond(200, execution.culture_info(data))
                if path == "/chat/next":
                    result = chat(execution.chat_request(data))
                    return self.respond(200, dict(result, next=result["suggestions"]))
                if path == "/pet/generate":
                    data = execution.pet_request(data)
                if path == "/api/chat":
                    return self.respond(200, chat(data))
                result = create_pet(data)
                if result is None:
                    return self.respond(503, {"error": "尚未配置千问图像服务。可先使用演示旅伴。"})
                return self.respond(202, result)
            except (ValueError, UnicodeError) as error:
                return self.respond(400, {"error": str(error)})
        if path == "/api/dreams":
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 4096:
                    raise ValueError("请求大小无效。")
                data = json.loads(self.rfile.read(size))
                if not isinstance(data, dict) or set(data) != {"wish"}:
                    raise ValueError("请求必须包含 wish 字段。")
                result = compile_wish(data["wish"])
            except (ValueError, UnicodeError):
                return self.respond(400, {"error": "请求无效，请提交 1 到 200 个字符的愿望。"})
            if result["status"] == "ready":
                ident = uuid.uuid4().hex
                result["session_id"] = ident
                with lock:
                    dreams[ident] = result
            return self.respond(200, result)
        parts = path.strip("/").split("/")
        if len(parts) == 4 and parts[:2] == ["api", "dreams"] and parts[3] == "complete":
            with lock:
                dream = dreams.get(parts[2])
                if not dream:
                    return self.respond(404, {"error": "体验不存在。"})
                dream["completed"] = True
                card = make_card(parts[2], dream)
            return self.respond(200, card)
        self.respond(404, {"error": "接口不存在。"})

    def do_GET(self):
        CONFIG.reload(provider_state.reset)
        request_path = urlsplit(self.path).path
        if request_path == "/" or not request_path.startswith(("/api/", "/health", "/chat/", "/pet/", "/scene/", "/culture/")):
            if self.serve_static("/index.html" if request_path == "/" else request_path):
                return
        parts = request_path.strip("/").split("/")
        if parts == ["health"]:
            return self.respond(200, {"status": "ok", "version": API_VERSION, "workspace_id": WORKSPACE_ID, "content_version": CONTENT["version"],
                                     "image_configured": bool(api_key()), "chat_configured": bool(api_key()),
                                     "voice_configured": bool(voice.voice_key()),
                                     "services": {kind: provider_state.status(kind) for kind in ("chat", "image", "asr", "tts")}})
        if parts == ["api", "content"]:
            return self.respond(200, CONTENT)
        if len(parts) in (3, 4) and parts[:2] == ["api", "pets"]:
            if len(parts) == 3:
                pet = latest_pet() if parts[2] == "latest" else get_pet(parts[2])
                return self.respond(200, pet) if pet else self.respond(404, {"error": "角色不存在。"})
            if parts[3] == "image":
                image = pet_image(parts[2])
                if image:
                    self.send_response(200)
                    self.send_header("Content-Type", "image/png")
                    self.send_header("Content-Length", str(len(image)))
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    return self.wfile.write(image)
                return self.respond(404, {"error": "角色图像尚未就绪。"})
        if len(parts) == 3 and parts[:2] == ["api", "dreams"]:
            with lock:
                dream = dreams.get(parts[2])
            return self.respond(200, dream) if dream else self.respond(404, {"error": "体验不存在。"})
        if len(parts) == 3 and parts[:2] == ["api", "postcards"]:
            with lock:
                dream = dreams.get(parts[2])
                if dream and dream.get("completed"):
                    card = make_card(parts[2], dream)
                else:
                    card = None
            return self.respond(200, card) if card else self.respond(404, {"error": "作品不存在。"})
        self.respond(404, {"error": "接口不存在。"})


class LocalHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


if __name__ == "__main__":
    port = int(os.getenv("DEMO_PORT", "8765"))
    print(f"Local demo API: http://127.0.0.1:{port}", flush=True)
    LocalHTTPServer(("127.0.0.1", port), Handler).serve_forever()
