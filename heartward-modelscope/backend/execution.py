"""Adapters for the four routes in the execution PRD; no provider calls here."""
from .content import CONTENT, allowed_targets


def chat_request(data):
    if not isinstance(data, dict):
        raise ValueError("对话请求无效。")
    result = dict(data)
    result["scene_id"] = result.pop("scene", result.get("scene_id"))
    result["message"] = result.pop("user_text", result.get("message", ""))
    return result


def pet_request(data):
    if not isinstance(data, dict):
        raise ValueError("上传数据无效。")
    result = dict(data)
    image = result.pop("pet_image", None)
    if image is not None:
        if not isinstance(image, str) or not image.startswith(("data:image/png;base64,", "data:image/jpeg;base64,")):
            raise ValueError("pet_image 需要 PNG 或 JPG 的 base64 data URL。")
        header, encoded = image.split(",", 1)
        result.update(mime_type=header[5:].split(";")[0], image_base64=encoded)
    return result


def switch_scene(data):
    if not isinstance(data, dict):
        raise ValueError("场景请求无效。")
    target = data.get("target_scene")
    current = data.get("scene", "home")
    view = data.get("view_id", "outside" if current == "ocean" else "default")
    if not isinstance(current, str) or current not in CONTENT["scenes"]:
        raise ValueError("当前场景无效。")
    if not isinstance(view, str) or view not in ({"inside", "outside"} if current == "ocean" else {"default"}):
        raise ValueError("视角无效。")
    if not isinstance(target, str) or target not in CONTENT["scenes"]:
        raise ValueError("目标场景无效。")
    if target != current and target not in allowed_targets(current, view):
        raise ValueError("不能从当前场景直接进入目标场景。")
    return {"scene_data": dict(CONTENT["scenes"][target], scene_id=target),
            "content_version": CONTENT["version"], "source": "authored"}


def culture_info(data):
    if not isinstance(data, dict) or data.get("scene") != "desert":
        raise ValueError("文化卡只属于文脉之境的沙漠场景。")
    target = data.get("object")
    if not isinstance(target, str) or target not in CONTENT["culture_cards"]:
        raise ValueError("该物件尚无文化卡。")
    card = CONTENT["culture_cards"][target]
    return {"scene": "desert", "object": target, "title": card["title"],
            "explanation": card["interpretation"], "suggestion": card["question"],
            "action": card["action"], "review_status": card["review_status"],
            "source": "authored", "content_version": CONTENT["version"]}
