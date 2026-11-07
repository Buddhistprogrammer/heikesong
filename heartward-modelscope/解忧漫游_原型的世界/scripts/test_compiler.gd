extends SceneTree
## 护城河层自测 · T2 交付版
## 覆盖：IP 脱敏（IP 关键词全表）· 安全改写（6 类）· 原型库完整性 · 边界 · 输出契约
## 运行：Godot.exe --headless --path . --script res://scripts/test_compiler.gd

var _pass := 0
var _fail := 0
var _fails: Array = []


func _init() -> void:
	print("=== 愿望编译器 · 护城河层自测（T2 交付版） ===")
	_test_ip_masking()
	_test_safety_rewrite()
	_test_prototype_integrity()
	_test_boundaries()
	_test_output_contract()
	print("\n=== 通过 %d / 失败 %d ===" % [_pass, _fail])
	if _fail > 0:
		for f in _fails:
			print("  x ", f)
		quit(1)
	else:
		quit(0)


## ── ① IP 脱敏 ──
func _test_ip_masking() -> void:
	print("\n-- 1. IP 脱敏 --")
	var ip_cases := {
		"我想去小王子的星球": "planet",
		"我想看海洋奇缘": "ocean_sky",
		"我想去海底总动员": "ocean_sky",
		"我想去霍格沃茨": "castle",
		"我想去云上的城堡": "castle",
		"我想去天空之城": "cloud_ladder",
		"我想去看宝可梦": "forest",
		"我想去动物森友会": "forest",
		"我想去赛博坦": "space_station",
		"我想看高达": "space_station",
		"我想去千与千寻": "forest",
		"我想去看光遇": "cloud_ladder",
	}
	for wish in ip_cases:
		var r := WishCompiler.compile(str(wish))
		var expect: String = ip_cases[wish]
		_check(r["proto_id"] == expect,
			"「%s」→ %s" % [wish, expect], str(r["proto_id"]))
		for field in ["title", "desc", "base_title", "symbol"]:
			_check(not _has_ip(str(r.get(field))), "输出 %s 不含 IP 名" % field, str(r.get(field)))

	var r2 := WishCompiler.compile("我想去小王子的星球")
	_check(not str(r2["title"]).contains("小王子"), "标题不含『小王子』", str(r2["title"]))
	_check(str(r2["title"]) == "我的星球", "标题=我的星球", str(r2["title"]))

	var r3 := WishCompiler.compile("我想看海洋奇缘")
	_check(str(r3["matched_ip"]) == "海洋奇缘", "长关键词优先命中『海洋奇缘』", str(r3["matched_ip"]))

	# 全表扫描：所有映射目标原型都存在
	for k in WishCompiler.ip_map():
		var pid: String = WishCompiler.ip_map()[k]
		var ok: bool = false
		for p in WishCompiler.prototypes():
			if p.get("id") == pid:
				ok = true
		_check(ok, "映射「%s」→ %s 指向存在的原型" % [k, pid], pid)


## ── ② 安全改写 ──
func _test_safety_rewrite() -> void:
	print("\n-- 2. 安全改写 --")
	var cases := [
		"我想去爸爸加班的地方",
		"我想看他们欺负我",
		"我想去没人走过的夜路",
		"我好害怕那个噩梦",
		"我想让妈妈不要离开我",
		"我想买那个游戏机",
	]
	for w in cases:
		var r := WishCompiler.compile(str(w))
		_check(r["safety_applied"] == true, "「%s」触发安全改写" % w, str(r["safety_applied"]))
		_check(str(r["pet_line"]) != "", "安全改写有专属宠物台词", str(r["pet_line"]))
		var desc: String = str(r["desc"])
		for kw in ["加班", "欺负", "夜路", "噩梦", "离开", "游戏机"]:
			if str(w).contains(kw):
				_check(not desc.contains(kw), "改写后描述不含「%s」" % kw, desc)

	# 安全优先于 IP
	var r2 := WishCompiler.compile("我想去小王子的星球但是晚上")
	_check(r2["safety_applied"] == true, "安全优先于 IP 映射", str(r2["safety_applied"]))
	_check(not str(r2["layout"]).is_empty(), "安全改写后仍有布局参数", "")


## ── ③ 原型库完整性 ──
func _test_prototype_integrity() -> void:
	print("\n-- 3. 原型库完整性 --")
	_check(WishCompiler.prototypes().size() == 8, "原型数量 = 8", str(WishCompiler.prototypes().size()))
	var fields := ["id", "name", "symbol", "desc", "props", "palette", "tripo_prompt", "layout", "keywords_hint"]
	for p in WishCompiler.prototypes():
		var missing := ""
		for f in fields:
			if not p.has(f) or str(p.get(f)).is_empty():
				missing = str(f)
		_check(missing.is_empty(), "原型 %s 字段完整" % p.get("id"), missing)
		_check(p.get("palette").size() == 3, "原型 %s 配色 3 色" % p.get("id"), str(p.get("palette").size()))
		_check(p.get("props").size() >= 3, "原型 %s 物件 >=3" % p.get("id"), str(p.get("props").size()))
		var tp: String = str(p.get("tripo_prompt"))
		_check(tp.contains("low-poly") or tp.contains("storybook") or tp.contains("pastel"),
			"原型 %s 的 tripo_prompt 含风格约束" % p.get("id"), tp.substr(0, 50))

	_check(WishCompiler.safety_rules().size() >= 6, "安全规则 >=6 条", str(WishCompiler.safety_rules().size()))
	for rule in WishCompiler.safety_rules():
		var ok: bool = rule.has("id") and rule.has("keywords") and rule.has("safe_title") \
			and rule.has("safe_desc") and rule.has("pet_line")
		_check(ok, "安全规则 %s 五要素齐全" % str(rule.get("id", "?")), "")
		_check(rule.get("keywords").size() > 0, "安全规则 %s 有关键词" % str(rule.get("id", "?")), "")


## ── ④ 边界 ──
func _test_boundaries() -> void:
	print("\n-- 4. 边界 --")
	var r0 := WishCompiler.compile("")
	_check(not str(r0["title"]).is_empty(), "空输入有兜底标题", str(r0["title"]))
	var rw := WishCompiler.compile("   ")
	_check(not str(rw["title"]).is_empty(), "纯空白有兜底标题", str(rw["title"]))
	var rl := WishCompiler.compile("我想去".repeat(50))
	_check(not str(rl["title"]).is_empty(), "超长输入不崩", str(rl["title"]))
	var rp := WishCompiler.compile("!!!???@@@###")
	_check(not str(rp["title"]).is_empty(), "纯符号输入有兜底", str(rp["title"]))
	var rm := WishCompiler.compile("我想去 Ocean 海洋")
	_check(not str(rm["title"]).is_empty(), "中英混排不崩", str(rm["title"]))
	for p in WishCompiler.prototypes():
		var rr := WishCompiler.compile(str(p.get("keywords_hint")).split(" / ")[0])
		_check(not str(rr["title"]).is_empty(), "原型 %s 关键词可编译" % p.get("id"), str(rr["title"]))


## ── ⑤ 输出契约（柠博 T4 / 我们 T7 直接消费） ──
func _test_output_contract() -> void:
	print("\n-- 5. 输出契约 --")
	var r := WishCompiler.compile("我想坐七彩玻璃球到海洋上空翱翔")
	var required := ["wish", "proto_id", "proto", "title", "base_title", "desc", "props",
		"palette", "layout", "tripo_prompt", "symbol", "safety_applied",
		"safety_id", "pet_line", "tail_line", "matched_ip"]
	for f in required:
		_check(r.has(f), "输出含字段 %s" % f, "")
	_check(str(r["tail_line"]) != "", "抵达金句非空", "")
	_check(str(r["tripo_prompt"]).length() > 30, "tripo_prompt 可直接喂生成", str(str(r["tripo_prompt"]).length()))
	_check(r["layout"].has("center") and r["layout"].has("radius"), "layout 含 center/radius", "")
	_check(WishCompiler.tail_lines().size() >= 4, "抵达金句 >=4 条", str(WishCompiler.tail_lines().size()))


## ── 工具 ──
func _has_ip(text: String) -> bool:
	## 只查「真实 IP 作品名 / 角色名」——原型自身的描述词（海洋/玻璃球/云/森林…）
	## 不是 IP 泄漏，是通用奇幻词汇，不在此列。
	var real_ip_names := [
		"小王子", "海洋奇缘", "海底总动员", "哈利波特", "霍格沃茨", "西游记",
		"红楼梦", "三国演义", "水浒传", "指环王", "魔戒", "爱丽丝", "彼得潘",
		"宝可梦", "皮卡丘", "原神", "塞尔达", "马里奥", "米老鼠", "公主裙",
		"变形金刚", "高达", "光遇", "千与千寻", "龙猫", "天空之城", "疯狂动物城",
		"动物森友会", "冰雪奇缘", "艾莎", "寻梦环游记", "海底小纵队", "汪汪队",
		"苏斯", "逃家小兔", "好饿的毛毛虫", "三只小猪", "总动员", "赛博坦",
		"银河系漫游", "星际穿越", "爱丽丝梦游", "多啦", "皮卡丘", "美人鱼",
		"小美人鱼", "海王", "悟空", "猪八戒", "白娘子", "机器猫", "叮当",
		"格林童话", "安徒生", "吹牛", "小红帽", "睡美人", "丑小鸭", "灰姑娘"
	]
	for n in real_ip_names:
		if text.contains(n):
			return true
	return false


func _check(cond: bool, label: String, actual: String) -> void:
	if cond:
		_pass += 1
		print("  [PASS] ", label)
	else:
		_fail += 1
		_fails.append("%s  (实际: %s)" % [label, actual])
		print("  [FAIL] ", label, "  (实际: ", actual, ")")
