// 文脉场景台词和动作可由内容团队独立调整。
window.HXLiterary = {
  opening: "咦，你在看《小王子》呀！很棒的一本书，要不要一起走进书里探索一下？",
  hotspots: {
    tree: {sceneId:"literary_desert", hotspotId:"baobab", childLine:"这棵树怎么长得这么奇怪？", dogLine:"它叫猴面包树。有些小烦恼如果一直不去面对，也会像它一样越长越大哦。", dogAction:"nod", effect:"tree", enabled:true},
    well: {sceneId:"literary_desert", hotspotId:"well", childLine:"沙漠里怎么会有一口井？", dogLine:"没想到吧！即使在荒凉的沙漠里，也会藏着惊喜。而且，有人陪你一起寻找，旅程也会变得更温暖呀！", dogAction:"tail_wag", effect:"well", enabled:true},
    stars: {sceneId:"literary_desert", hotspotId:"star", childLine:"这颗星星里面有什么？", dogLine:"每颗星星都藏着一个世界。走，我们去看看还有哪些故事！", dogAction:"happy_hop", effect:"star", nextAction:"worlds", enabled:true}
  }
};
