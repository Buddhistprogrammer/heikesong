"""One shared, versioned content source for Godot and Python."""
import json
from pathlib import Path

CONTENT_PATH = Path(__file__).resolve().parents[1] / "解忧漫游_原型的世界" / "assets" / "data" / "v6_content.json"
CONTENT = json.loads(CONTENT_PATH.read_text(encoding="utf-8"))
TARGETS = {key: value["targets"] for key, value in CONTENT["scenes"].items()}
ACTIONS = frozenset(CONTENT["actions"])
CARDS = {key: value["interpretation"] + " " + value["question"]
         for key, value in CONTENT["culture_cards"].items()}


def allowed_targets(scene, view="default"):
    if scene == "ocean" and view == "inside":
        return ["home"]
    return TARGETS[scene]


def fallback(scene, hotspot, message, view="default", history=()):
    """Bounded local dialogue rules: clearly labelled as preset, never as AI."""
    if scene == "desert":
        card = CONTENT["culture_cards"].get(hotspot)
        if card:
            initial = not history or any(word in message for word in ("含义", "理解", "为什么在", "这是什么"))
            if initial:
                return card["interpretation"] + "\n" + card["question"], card["action"], card["suggestions"]
            if any(word in message for word in ("作者", "原文", "哪一章", "哪一年", "原著")):
                return "这张卡片只提供一种意象解读，不能据此确认作者生平、章节或原文。我们可以回到当前的意象，聊聊它让你想到什么。", "look_up", card["suggestions"]
            if hotspot == "tree":
                if any(word in message for word in ("植物", "浇水", "花", "照顾")):
                    line = "照料植物是个很具体的开始。可以先观察它今天的状态，再决定需要什么；把关心变成一件小事，就有了成长的空间。"
                elif any(word in message for word in ("问题", "拖延", "作业", "学习")):
                    line = "把一个大问题拆成今天能做的一小步，也是一种照料。你愿意先选最容易开始的一步吗？"
                else:
                    line = "你把树的意象和自己的生活连了起来。照料可以从很小的一步开始：今天先做哪件事，会让你觉得更踏实？"
            else:
                if any(word in message for word in ("陪伴", "家人", "朋友", "爸爸", "妈妈")):
                    line = "陪伴虽然不能拿在手里，却可以在一起寻找、等待和倾听时被感受到。这个理解，和水井所引出的珍贵很贴近。"
                elif any(word in message for word in ("过程", "寻找", "为什么")):
                    line = "一起寻找时的付出、期待和相处，也会让终点变得有意义。水井让我们看到希望，也给了我们回望旅程的机会。"
                else:
                    line = "那份珍贵可以先留在你的理解里，不用和别人的答案一样。水井像一个邀请：再看看生活中那些不太显眼、却让你安心的东西。"
            return line, card["action"], card["suggestions"]
        return CONTENT["scenes"][scene]["fallback"], "idle", ["tree", "well"]
    if scene == "ocean":
        if view == "outside":
            return "七彩玻璃球正漂浮在海面上空。你的愿望已经有了模样；想和我坐进去看海，还是先回家？", "look_up", ["inside", "home"]
        if any(word in message for word in ("送给", "爸", "妈", "想念", "家人")):
            return "那就把这片想象中的海，变成一句想对他们说的话吧。回家以后，可以亲自把这份心意告诉他们。现在我陪你再看一会儿。", "sit", ["home"]
        return CONTENT["scenes"][scene]["fallback"], "sit", ["home"]
    if any(word in message for word in ("爸", "妈", "想念", "父母", "孤单")):
        return "想念家人时，心里可能会空一点。我陪你坐一会儿；也可以先写一句想对他们说的话，等方便时亲自联系他们。然后，要不要告诉我一个小愿望？", "approach", ["ocean", "desert"]
    if any(word in message for word in ("海", "玻璃球", "愿望", "彩虹")):
        return "我听见你的愿望了：坐进七彩玻璃球，让大海在脚下慢慢展开。准备好时，点击下方的“实现愿望”，我们一起出发。", "look_up", ["ocean", "desert"]
    if any(word in message for word in ("书", "小王子", "沙漠")):
        return "书桌上那本《小王子》里，有关于寻找和照料的意象。翻开书页，我们可以在同一片沙漠里去看树和水井。", "turn_book", ["desert", "ocean"]
    return CONTENT["scenes"][scene]["fallback"], "idle", ["ocean", "desert"]
