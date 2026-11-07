extends RefCounted
class_name WishCompiler
## 愿望编译器 — 孩子的一句话 → 场景剧本
## ═══════════════════════════════════════════════════════════════
## 【T2 交付版 · 2026-11-05 · 蒋平/陆沉】
##
## 本层是产品的护城河，做三件事：
##  1. IP 脱敏：把孩子说的「某某 IP 场景」映射到通用奇幻原型
##     → 输出中不出现任何 IP 名称与角色形象（零授权风险）
##  2. 安全改写：把危险/不适龄的愿望改写成安全版本
##     → 不是拒绝，是"替孩子改写世界"
##  3. 产出完整场景剧本：物件清单 + 配色 + 布局 + Tripo 提示词
##     → 供柠博的 T4（LLM 扩写）与我们的 T7（Tripo 资产）直接消费
##
## 接入 LLM 时：只替换 compile() 内部实现，
## 本文件的 PROTOTYPES / IP_KEYWORD_MAP / SAFETY_RULES 作为前置约束传给模型，
## 本地规则继续做兜底校验 —— 护城河不交给模型。
## ═══════════════════════════════════════════════════════════════


## ─────────────────────────────────────────────────────────────
## 一 · 通用奇幻场景原型库（8 个 · 覆盖任意 IP 场景）
## 每个原型含：desc 场景描述 / props 物件清单 / palette 配色
##              tripo_prompt 生成提示词 / layout 引擎布局参数
## ─────────────────────────────────────────────────────────────
const PROTOTYPES: Array = [
	{
		"id": "planet",
		"name": "星球",
		"symbol": "去不了的远方 · 一整个世界",
		"desc": "一颗悬浮在柔光雾里的小星球，有环形光晕和一片可以站人的草地",
		"props": ["球体地形", "环形光晕", "草地", "漂浮碎石"],
		"palette": ["#F6E7C8", "#C9B8E8", "#A8D8C8"],
		"tripo_prompt": "a small spherical planet terrain with soft grass surface, translucent glowing ring halo orbiting around it, floating small rocks, dreamy pastel fairy-tale storybook style, low-poly, soft edges",
		"layout": {"center": [0, 2.2, -6], "radius": 3.9, "props": 4},
		"keywords_hint": "太空 / 星球 / 宇宙 / 星星 / 月亮 / 火箭 / 飞船"
	},
	{
		"id": "rose_garden",
		"name": "玫瑰花园",
		"symbol": "会开的花 · 熬过的日子",
		"desc": "会呼吸的玫瑰花园，花瓣是半透明的，夜里会发出微光",
		"props": ["玫瑰丛", "花藤拱门", "发光花蕊", "石径"],
		"palette": ["#F3C9CE", "#E8D5A8", "#C7B9D6"],
		"tripo_prompt": "a breathing rose garden with translucent half-transparent petals softly glowing at night, flower vine arch, luminous stamens, stone path, pastel pink and cream, dreamy storybook illustration style, low-poly",
		"layout": {"center": [0, 1.0, 0], "radius": 5.0, "props": 14},
		"keywords_hint": "花园 / 花 / 玫瑰 / 春天 / 蝴蝶 / 精灵"
	},
	{
		"id": "lighthouse",
		"name": "灯塔",
		"symbol": "方向 · 总有一处亮着",
		"desc": "一座圆滚滚的小灯塔，立在一块浮空的小岛上，光束一直朝着天亮的方向",
		"props": ["灯塔", "浮空岛", "旋转光束", "礁石"],
		"palette": ["#F5D08A", "#9FC6DE", "#EFE7D8"],
		"tripo_prompt": "a small round chubby lighthouse standing on a floating tiny island, warm golden rotating light beam pointing toward dawn, scattered reef rocks below, soft misty pastel sky, fairy-tale storybook style, low-poly",
		"layout": {"center": [0, 2.2, -7], "radius": 1.3, "props": 9},
		"keywords_hint": "灯塔 / 海边 / 灯 / 港口 / 指引 / 岸"
	},
	{
		"id": "cloud_ladder",
		"name": "云梯",
		"symbol": "通路 · 通向够不到的地方",
		"desc": "一条由软白云朵搭成的梯子，一直伸进没有尽头的天里",
		"props": ["云阶", "浮空平台", "风带", "光尘"],
		"palette": ["#E8F1FA", "#D6E4F2", "#F0E6D8"],
		"tripo_prompt": "a ladder made of soft white clouds spiraling upward into endless sky, floating cloud platforms, gentle wind ribbons, sparkling light dust, pale blue and cream pastel, whimsical storybook style, low-poly",
		"layout": {"center": [0, 5.5, -9], "radius": 2.4, "props": 11},
		"keywords_hint": "云 / 天空 / 梯子 / 高 / 爬 / 彩虹 / 天上"
	},
	{
		"id": "ocean_sky",
		"name": "海洋上空",
		"symbol": "像孩子一样飞 · 玻璃球里的世界",
		"desc": "漂在海面上方的空中，脚下是透明的七彩玻璃球，浪在云里起伏",
		"props": ["七彩玻璃球", "云海浪", "悬浮水珠", "光柱"],
		"palette": ["#BFE3EF", "#C9B8E8", "#F6E7C8"],
		"tripo_prompt": "a large transparent iridescent glass sphere floating above the sea, waves undulating in the clouds below, suspended water droplets, soft light pillars, dreamy pastel aqua and lavender, fairy-tale storybook style, low-poly",
		"layout": {"center": [0, 3.4, -6], "radius": 3.4, "props": 12},
		"keywords_hint": "海 / 海洋 / 水 / 鱼 / 鲸 / 潜水 / 游 / 飞 / 玻璃球"
	},
	{
		"id": "forest",
		"name": "发光森林",
		"symbol": "时间 · 长出来的光",
		"desc": "一棵棵会呼吸的树，叶子是淡粉色的，森林里有缓慢飘落的光点",
		"props": ["开花的树", "光点", "苔藓小径", "藤蔓"],
		"palette": ["#F0C8D4", "#B8D8C0", "#F5EEDC"],
		"tripo_prompt": "a breathing forest of slender trees with pale pink leaves, slowly drifting points of light, mossy small path, hanging vines, pastel pink and mint green, dreamlike twilight fairy-tale storybook style, low-poly",
		"layout": {"center": [0, 1.0, -6], "radius": 6.0, "props": 21},
		"keywords_hint": "森林 / 树 / 丛林 / 山 / 童话 / 蘑菇 / 木屋"
	},
	{
		"id": "castle",
		"name": "云上城堡",
		"symbol": "家 · 有人在等的地方",
		"desc": "一座圆塔小城堡浮在云海上，窗户里透出暖黄色的灯",
		"props": ["圆塔", "浮桥", "旗子", "云台"],
		"palette": ["#E8DCC8", "#B8C4D6", "#F6D8A8"],
		"tripo_prompt": "a round-towered small castle floating above a sea of clouds, warm yellow light glowing from its windows, little floating bridge, tiny flags, soft cream and dusty blue pastel, storybook fairy-tale style, low-poly",
		"layout": {"center": [0, 3.2, -8], "radius": 2.2, "props": 10},
		"keywords_hint": "城堡 / 王国 / 家 / 塔 / 骑士 / 公主 / 城墙 / 宫殿"
	},
	{
		"id": "space_station",
		"name": "太空舱",
		"symbol": "未知的伙伴 · 另一个世界",
		"desc": "一间飘在星空里的小舱，舷窗外有慢慢转的星环",
		"props": ["舱体", "舷窗", "星环", "浮标"],
		"palette": ["#C8D4E8", "#E8E0F0", "#F0E0C8"],
		"tripo_prompt": "a small cozy cabin floating in a starry sky, round porthole window, slowly rotating planetary rings around it, small floating markers, pale blue and lilac pastel, dreamy storybook style, low-poly",
		"layout": {"center": [0, 2.8, -7], "radius": 3.4, "props": 13},
		"keywords_hint": "太空 / 宇宙 / 飞船 / 空间站 / 星球 / 科幻 / 舱"
	}
]


## ─────────────────────────────────────────────────────────────
## 二 · IP 脱敏映射表
## 孩子说的 IP 场景 → 通用原型
## 规则：长关键词优先（避免「海洋奇缘」被「海洋」抢先）
##      命中即改写，输出永不含 IP 名称
## ─────────────────────────────────────────────────────────────
const IP_KEYWORD_MAP: Dictionary = {
	# ── 小王子系 ──
	"小王子的星球": "planet", "小王子": "planet", "玫瑰": "rose_garden",
	"玫瑰花园": "rose_garden", "玻璃球": "ocean_sky", "看猴面包树": "forest",
	"猴面包树": "forest", "扳道工": "castle", "飞行员": "planet",
	"埋信人": "planet", "点灯人": "lighthouse",
	# ── 海洋系 ──
	"海洋奇缘": "ocean_sky", "海底总动员": "ocean_sky", "小美人鱼": "ocean_sky",
	"美人鱼": "ocean_sky", "海底": "ocean_sky", "鲸鱼": "ocean_sky",
	"海王": "ocean_sky", "海洋": "ocean_sky", "潜水": "ocean_sky",
	# ── 太空系 ──
	"星球大战": "space_station", "赛博坦": "space_station", "变形金刚": "space_station", "银河系漫游": "space_station",
	"星际穿越": "space_station", "太空": "space_station", "宇宙": "space_station",
	"火箭": "space_station", "飞船": "space_station", "空间站": "space_station",
	"外星人": "space_station", "月球": "planet", "星星": "planet",
	# ── 森林系 ──
	"魔幻森林": "forest", "森林": "forest", "丛林": "forest", "树屋": "forest",
	"童话": "forest", "蘑菇屋": "forest", "精灵": "forest", "小矮人": "forest",
	# ── 城堡系 ──
	"哈利波特": "castle", "霍格沃茨": "castle", "魔法学校": "castle",
	"西游记": "castle", "孙悟空": "forest", "猪八戒": "forest",
	"白娘子": "forest", "梁山伯": "forest", "红楼梦": "rose_garden",
	"三国演义": "castle", "水浒传": "forest", "指环王": "forest",
	"魔戒": "forest", "爱丽丝": "forest", "彼得潘": "forest",
	"格林": "forest", "安徒生": "forest", "城堡": "castle", "王国": "castle",
	"公主": "castle", "骑士": "castle", "皇宫": "castle", "塔": "castle",
	# ── 光与云系 ──
	"天空之城": "cloud_ladder", "云": "cloud_ladder", "彩虹": "cloud_ladder",
	"梯子": "cloud_ladder", "天空": "cloud_ladder", "天使": "cloud_ladder",
	# ── 其他常见儿童内容 ──
	"海底小纵队": "ocean_sky", "汪汪队": "forest", " Peppa": "forest",
	"苏斯": "forest", "逃家小兔": "forest", "好饿的毛毛虫": "forest",
	"母鸡萝丝去散步": "forest", "猜猜我有多爱你": "forest",
	"晚安月亮": "space_station", "月亮先生": "space_station",
	"三只小猪": "castle", "小房子": "castle", "玩具总动员": "castle",
	"机器人总动员": "space_station",
	"冰雪奇缘": "forest", "艾莎": "forest", "安娜": "forest",
	"寻梦环游记": "forest", "千与千寻": "forest", "哈尔": "forest",
	"龙猫": "forest", "豆豆龙": "forest",
	"幽灵公主": "forest", "崖上的波妞": "ocean_sky", "铃芽之旅": "forest",
	"宝可梦": "forest", "皮卡丘": "forest", " pokémon": "forest",
	"高达": "space_station", "奥特曼": "space_station", "怪兽": "forest",
	"光遇": "cloud_ladder", "原神": "forest", "塞尔达": "forest",
	"动物森友会": "forest", "马里奥": "forest", "超级马里奥": "forest",
	"米老鼠": "castle", "迪士尼": "castle", "公主裙": "rose_garden",
}


## ─────────────────────────────────────────────────────────────
## 三 · 安全改写规则
## 不是拒绝，是替孩子改写世界
## 每条必须配：安全标题 / 安全描述 / 专属宠物台词
## ─────────────────────────────────────────────────────────────
const SAFETY_RULES: Array = [
	{
		"id": "night_street",
		"keywords": ["夜路", "深夜", "晚上", "夜里", "天黑", "半夜", "一个人走", "一个人出去",
			"偏僻", "无人区", "工地", "矿井", "下水道", "后巷", "黑漆漆"],
		"safe_title": "傍晚的街角",
		"safe_desc": "天刚黑，街灯一盏一盏亮起来，远处有人在等门",
		"pet_line": "那个地方有点黑，我把它换成傍晚了，我们一样能过去。"
	},
	{
		"id": "parent_work",
		"keywords": ["爸爸加班", "妈妈上班", "办公室", "工位", "会议室", "加班", "上班的地方"],
		"safe_title": "书桌上的角落",
		"safe_desc": "一盏台灯，一杯还冒热气的咖啡，一叠今天还没写完的纸",
		"pet_line": "加班的地方我们没去过，不过我看见了他桌上有什么。"
	},
	{
		"id": "bullied",
		"keywords": ["打架", "被欺负", "打人", "欺负我", "吵架", "骂我", "抢我东西"],
		"safe_title": "安静的操场",
		"safe_desc": "傍晚的操场只有你一个人，风把你的影子拉得很长",
		"pet_line": "有人的地方我们先不去了，我带你找个安静的地方站一会儿。"
	},
	{
		"id": "abandon",
		"keywords": ["死", "消失", "不要我", "抛弃", "离开我", "不见了", "回不来", "不回来"],
		"safe_title": "亮着灯的屋子",
		"safe_desc": "一扇亮着灯的窗户，桌上有一杯为你留着的温水",
		"pet_line": "别怕，我们先去那间亮着灯的屋子，好不好？"
	},
	{
		"id": "scary",
		"keywords": ["恐怖", "鬼", "怪兽", " scary", "害怕", "噩梦", "死人", "棺材"],
		"safe_title": "会发光的小森林",
		"safe_desc": "树在慢慢呼吸，叶子飘下来的地方会亮起一小块光",
		"pet_line": "那个太黑了，我们去会发光的地方好不好？"
	},
	{
		"id": "money",
		"keywords": ["买", "钱", "游戏机", "玩具", "零食", "糖果", "充值"],
		"safe_title": "愿望摊",
		"safe_desc": "一个只卖「想看的东西」的小摊，每个摊位都通向一个场景",
		"pet_line": "想买的东西我们先不买，我们直接去它住的地方看看。"
	}
]


## ─────────────────────────────────────────────────────────────
## 四 · 编译结果结构
## {
##   wish: 原始愿望, proto_id: 原型 id, proto: 原型字典,
##   title: 场景标题（由原型名生成·不含 IP）, base_title: 原型名,
##   desc: 场景描述, props: 物件清单, palette: 配色,
##   layout: 引擎布局参数, tripo_prompt: 生成提示词,
##   safety_applied: bool, safety_id: 命中的安全规则 id,
##   pet_line: 宠物该说的第一句, tail_line: 抵达金句,
##   matched_ip: 命中的 IP 关键词（内部审计用·不进输出）
## }
## ─────────────────────────────────────────────────────────────

const TAIL_LINES: Array = [
	"诗和远方暂时去不了，但你已经到过了。",
	"你心里那个地方，今天亮了一盏灯。",
	"现在它不只是画面了——你走过它。",
	"我们没有真的去到那里，但你到过了。"
]


## ─────────────────────────────────────────────────────────────
## 五 · 主入口
## ─────────────────────────────────────────────────────────────
static func compile(wish: String) -> Dictionary:
	var w := wish.strip_edges()
	if w.is_empty():
		w = "我想去看海"

	# ① 安全改写优先（先于 IP 映射 —— 安全是底线）
	var safety_hit := {}
	for rule in SAFETY_RULES:
		for kw in rule["keywords"]:
			if w.contains(str(kw)):
				safety_hit = rule
				break
		if not safety_hit.is_empty():
			break

	# ② 原型匹配
	var proto_id := ""
	var matched_ip := ""
	if not safety_hit.is_empty():
		proto_id = _proto_for_safety(safety_hit)
	else:
		var m := _proto_for_wish(w)
		proto_id = m["id"]
		matched_ip = m["keyword"]

	var proto := _get_proto(proto_id)

	var title: String = proto["name"]
	var desc: String = proto["desc"]
	var pet_line := ""
	var safety_applied := false
	var safety_id := ""

	if not safety_hit.is_empty():
		safety_applied = true
		safety_id = str(safety_hit["id"])
		title = str(safety_hit["safe_title"])
		desc = str(safety_hit["safe_desc"])
		pet_line = str(safety_hit["pet_line"])

	# ③ 标题脱敏（只由原型名生成 · 绝不用孩子原话）
	var my_title := _make_title(w, title, safety_applied)

	return {
		"wish": w,
		"proto_id": proto_id,
		"proto": proto,
		"title": my_title,
		"base_title": title,
		"desc": desc,
		"props": proto["props"],
		"palette": proto["palette"],
		"layout": proto["layout"],
		"tripo_prompt": proto["tripo_prompt"],
		"symbol": proto["symbol"],
		"safety_applied": safety_applied,
		"safety_id": safety_id,
		"pet_line": pet_line,
		"tail_line": TAIL_LINES[randi() % TAIL_LINES.size()],
		"matched_ip": matched_ip
	}


## ─────────────────────────────────────────────────────────────
## 六 · 工具方法
## ─────────────────────────────────────────────────────────────

## 按愿望匹配原型（长关键词优先 · 返回 id 与命中词）
static func _proto_for_wish(w: String) -> Dictionary:
	var keys := IP_KEYWORD_MAP.keys()
	keys.sort_custom(func(a, b): return len(str(a)) > len(str(b)))
	for k in keys:
		if w.contains(str(k)):
			return {"id": str(IP_KEYWORD_MAP[k]), "keyword": str(k)}
	# 语义兜底（无 IP 命中时）
	if w.contains("海") or w.contains("水") or w.contains("鱼") or w.contains("飞"):
		return {"id": "ocean_sky", "keyword": ""}
	if w.contains("山") or w.contains("高") or w.contains("天") or w.contains("爬"):
		return {"id": "cloud_ladder", "keyword": ""}
	if w.contains("花") or w.contains("草") or w.contains("树"):
		return {"id": "rose_garden", "keyword": ""}
	if w.contains("星") or w.contains("宇宙") or w.contains("月"):
		return {"id": "space_station", "keyword": ""}
	if w.contains("家") or w.contains("房") or w.contains("屋"):
		return {"id": "castle", "keyword": ""}
	if w.contains("灯") or w.contains("岸"):
		return {"id": "lighthouse", "keyword": ""}
	return {"id": "planet", "keyword": ""}


## 安全规则 → 对应原型（安全版本也有视觉落点）
static func _proto_for_safety(rule: Dictionary) -> String:
	var kws: Array = rule["keywords"]
	if kws.has("办公室") or kws.has("工位") or kws.has("加班") or kws.has("会议室") or kws.has("上班的地方"):
		return "forest"
	if kws.has("打架") or kws.has("欺负") or kws.has("吵架") or kws.has("骂我"):
		return "forest"
	if kws.has("死") or kws.has("消失") or kws.has("抛弃") or kws.has("离开我"):
		return "rose_garden"
	if kws.has("恐怖") or kws.has("鬼") or kws.has("害怕") or kws.has("噩梦"):
		return "forest"
	if kws.has("买") or kws.has("钱") or kws.has("充值"):
		return "rose_garden"
	return "planet"


static func _get_proto(pid: String) -> Dictionary:
	for p in PROTOTYPES:
		if p["id"] == pid:
			return p
	return PROTOTYPES[0]


## 🔴 IP 脱敏铁律：标题只由「原型名 / 安全标题」生成，
##    绝不把孩子的原话（可能含 IP 名）当标题。
##    孩子的原话仅保留在 wish 字段（内部）。
static func _make_title(w: String, base: String, safety_applied: bool) -> String:
	if safety_applied:
		return "我的%s" % base
	# 剥掉任何命中 IP 关键词表的片段
	var keys := IP_KEYWORD_MAP.keys()
	keys.sort_custom(func(a, b): return len(str(a)) > len(str(b)))
	for k in keys:
		base = base.replace(str(k), "")
	# 剥掉常见作品名残留
	for bad in ["小王子", "海洋奇缘", "海底总动员", "哈利波特", "霍格沃茨", "西游记",
			"红楼梦", "三国演义", "水浒传", "指环王", "魔戒", "爱丽丝", "彼得潘",
			"宝可梦", "皮卡丘", "原神", "塞尔达", "马里奥", "米老鼠", "公主裙",
			"变形金刚", "高达", "光遇", "千与千寻", "龙猫", "天空之城", "疯狂动物城",
			"动物森友会", "冰雪奇缘", "艾莎", "寻梦环游记", "海洋奇缘", "海底小纵队",
			"汪汪队", "苏斯", "逃家小兔", "好饿的毛毛虫", "三只小猪", "总动员",
			"精灵", "公主", "骑士", "外星人", "宇航员"]:
		base = base.replace(bad, "")
	base = base.strip_edges()
	if base.is_empty():
		base = _get_proto("planet")["name"]
	return "我的%s" % base

## ── 对外只读访问器（供测试与外部工具消费）
## GDScript 的 const 无法在类型推断上下文（如 for k in Class.CONST）中跨类解析，
## 故统一走静态方法返回，避免下游脚本踩这个坑。
static func prototypes() -> Array:
	return PROTOTYPES

static func ip_map() -> Dictionary:
	return IP_KEYWORD_MAP

static func safety_rules() -> Array:
	return SAFETY_RULES

static func tail_lines() -> Array:
	return TAIL_LINES
