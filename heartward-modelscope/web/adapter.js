(() => {
  "use strict";
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const state = {
    scene:"home", view:"default", hotspot:"", petId:"", petName:"美丽", image:"",
    wish:"", familyNote:"", histories:new Map(), content:null,
    generation:0, pendingPet:null, request:null, epoch:0, recording:null,
    micPending:false, transcribing:false, audio:null, speechRequest:null, speechEpoch:0,
    sphereX:0, flying:false, entered:false, portalTimer:null, editing:null, quickEdits:new Map(), quickSuggestions:[],
    demoConfig:null, actionTimer:null, actionToken:0, literaryStep:0,
    story:{node:-1,next:0,phase:"inactive",busy:false,controller:null}
  };
  const reasons = {billing:"账户计费异常", auth:"鉴权失败", no_key:"未配置密钥", cooldown:"服务暂时冷却", busy:"服务繁忙", invalid_output:"模型格式异常", support:"关怀预设", service_unavailable:"服务暂不可用"};
  const DEMO_CONFIG_KEY = "heartward.demo-lines.v2";
  const DEFAULT_DEMO_CONFIG = {
    openings: {
      home:"你今天好像比平时安静一些，想和我聊聊吗？",
      ocean:"你的小愿望有了模样：七彩玻璃球正漂浮在海面上空。我们坐进去，让海天慢慢展开吧。",
      study:"咦，你在看《小王子》呀！很棒的一本书，要不要一起走进书里探索一下？",
      literary:"我们走进了按书中意象绘制的沙漠。树和水井在同一张地图上，先去哪里，由你决定。"
    },
    quick: {
      home:{miss:"爸爸妈妈出差了，我有点想他们",wish:"我有一个愿望想实现……",book:"我想和你一起读《小王子》……",self:"我想自己说……"},
      ocean:{question0:"我想把这片海送给想念的人",question1:"我们安静地看一会儿海吧"},
      literary:{question0:"它为什么在这里？",question1:"这让我想到了自己的生活"}
    },
    interactions: {
      pet:"嘿嘿，你的手好暖。", play:"来，一起跳一下！", sit:"那我们就坐一会儿。", tilt:"我听见啦，正在认真想一想。"
    },
    story: [
      {id:"01",title:"家庭入场",scene:"home",speaker:"旅伴",text:"你今天好像比平时安静一些，想和我聊聊吗？",action:"idle→look_owner→head_tilt→tail_wag",transition:""},
      {id:"02",title:"主人迟疑",scene:"home",speaker:"主人",text:"嗯……我只是……",action:"listen→head_tilt",transition:""},
      {id:"03",title:"温柔引导",scene:"home",speaker:"旅伴",text:"哎呀，不要 emo 啦！我带你实现一个小愿望，好不好？",action:"stand→happy_hop→tail_wag",transition:""},
      {id:"04",title:"表达奇想",scene:"home",speaker:"主人",text:"我想坐在七彩玻璃球里看大海！",action:"look_at_portal→tail_wag",transition:""},
      {id:"05",title:"出发",scene:"home",speaker:"旅伴",text:"好呀！出发！",action:"run→jump",transition:"ocean"},
      {id:"06",title:"抵达海洋",scene:"ocean",speaker:"主人",text:"哇，大海好大！海鸥飞得好自由！",action:"sit→happy_tail_wag",transition:""},
      {id:"07",title:"奇想肯定",scene:"ocean",speaker:"旅伴",text:"你心里向往的世界真美！这是你创造的第一个小世界！",action:"look_owner→nod→tail_wag",transition:""},
      {id:"08",title:"调皮结尾",scene:"ocean",speaker:"旅伴",text:"等等……所以你才给我取名叫“美丽”吗？",action:"head_tilt→blink→tail_wag",transition:""}
    ]
  };
  let toastTimer, cultureBookLoading, worldEntrance, portalBook, portalLoadingTimer, portalActive=false;
  const desert={x:47, token:0, busy:false};
  function cloneDemoConfig() { return JSON.parse(JSON.stringify(DEFAULT_DEMO_CONFIG)); }
  function loadDemoConfig() {
    const defaults=cloneDemoConfig();
    try {
      const saved=JSON.parse(localStorage.getItem(DEMO_CONFIG_KEY) || "null");
      if(!saved || typeof saved !== "object") return defaults;
      // Migrate untouched V2 defaults, preserving text the user actually edited.
      const oldTexts=["今天想跟我说些什么？想念家人的时候，我们可以先在这里坐一会儿。也可以告诉我一个小小的愿望。","我有点不知道该从哪里说起。","不用急，我们可以先坐一会儿，想到什么就说什么。","我想坐进七彩玻璃球里看海。","好呀，带上这个愿望，我们一起出发。","你的小愿望有了模样：七彩玻璃球正漂浮在海面上空。我们坐进去，让海天慢慢展开吧。","你的想象很珍贵，它让这片海有了新的颜色。","要不要再向左一点？说不定会遇见一只海鸥。"];
      const merged={
        openings:{...defaults.openings,...(saved.openings || {})},
        quick:Object.fromEntries(Object.entries(defaults.quick).map(([scene,items]) => [scene,{...items,...(saved.quick?.[scene] || {})}])),
        interactions:{...defaults.interactions,...(saved.interactions || {})},
        story:defaults.story.map((item,index) => ({...item,text:saved.story?.[index]?.text && saved.story[index].text !== oldTexts[index] ? saved.story[index].text : item.text}))
      };
      if(merged.openings.home === oldTexts[0]) merged.openings.home=defaults.openings.home;
      if(merged.openings.study === "要不要和我一起走进《小王子》的世界？") merged.openings.study=defaults.openings.study;
      return merged;
    } catch(_) { return defaults; }
  }
  function saveDemoConfig() {
    try { localStorage.setItem(DEMO_CONFIG_KEY,JSON.stringify(state.demoConfig)); } catch(_) { toast("本机存储不可用，本次修改只保留到当前页面。"); }
  }
  function demoOpening(sceneName, fallback) { return state.demoConfig?.openings?.[sceneName] || fallback; }
  function demoQuick(sceneName, id, fallback) { return state.demoConfig?.quick?.[sceneName]?.[id] || fallback; }
  function demoInteraction(id, fallback) { return state.demoConfig?.interactions?.[id] || fallback; }
  function toast(text) {
    clearTimeout(toastTimer); $("#toast").textContent=text; $("#toast").classList.add("on");
    toastTimer=setTimeout(() => $("#toast").classList.remove("on"),3600);
  }
  async function request(url, data, {signal, timeout=25000, binary=false}={}) {
    const controller=new AbortController(), abort=() => controller.abort();
    signal?.addEventListener("abort",abort,{once:true}); if(signal?.aborted) abort();
    const timer=setTimeout(abort,timeout);
    try {
      const response=await fetch(url,{method:data === undefined ? "GET" : "POST",signal:controller.signal,
        headers:data === undefined ? {} : {"Content-Type":"application/json"}, body:data === undefined ? undefined : JSON.stringify(data)});
      if(!response.ok) {const error=await response.json().catch(() => ({})); throw new Error(error.error || `请求失败（${response.status}）`);}
      return binary ? await response.blob() : await response.json();
    } catch(error) {
      if(controller.signal.aborted && !signal?.aborted) throw new Error("请求超时，请稍后重试。");
      throw error;
    } finally {clearTimeout(timer); signal?.removeEventListener("abort",abort);}
  }
  const isCulture=() => ["study","literary"].includes(state.scene);
  const sceneId=() => isCulture() ? "desert" : state.scene;
  const sceneData=() => state.scene === "study" ? {
    opening:window.HXLiterary.opening,
    caption:"树下阅读 · 从一本书走进另一个世界",
    placeholder:"想和旅伴聊聊这本书吗？", quick_questions:["带我去看看猴面包树","沙漠里的水井意味着什么？"]
  } : state.content?.scenes[sceneId()];
  function history() {
    const key=`${state.scene}/${state.view}/${state.hotspot}`;
    if(!state.histories.has(key)) state.histories.set(key,[]);
    return state.histories.get(key);
  }
  function message(who,text,source="",entry=null) {
    if(!String(text || "").trim()) return;
    const box=$("#chat"), el=document.createElement("div"); el.className="msg"+(who === "user" ? " me" : "");
    el.innerHTML=`<div class="av">${who === "user" ? "我" : state.image ? `<img src="${esc(state.image)}" alt="">` : window.HXCharacters.defaultPet()}</div><div class="col"><div class="name">${who === "user" ? "我" : esc(state.petName)}</div><div class="bubble"><div class="message-text">${esc(text)}</div>${source ? `<div class="source">${esc(source)}</div>` : ""}<div class="message-tools"></div></div></div>`;
    const bubble=el.querySelector(".bubble"), body=el.querySelector(".message-text"), tools=el.querySelector(".message-tools");
    if(who !== "user") {
      const replay=button("朗读",() => speak(text),"replay"); replay.title="朗读这条回复"; tools.appendChild(replay);
    }
    const edit=button("",() => {
      if(state.request || state.recording || state.transcribing || state.micPending) return;
      state.editing?.cancel(); stopSpeech();
      const editor=document.createElement("div"); editor.className="message-editor";
      const input=document.createElement("textarea"); input.className="message-edit-input";
      input.value=text; input.maxLength=who === "user" ? 500 : Math.max(2000,text.length);
      input.rows=4; input.setAttribute("aria-label",who === "user" ? "编辑我的消息" : "编辑小狗的消息");
      const actions=document.createElement("div"); actions.className="message-edit-actions";
      const close=() => {
        editor.remove(); body.hidden=false; tools.hidden=false;
        state.editing=null; updateControls(); edit.focus({preventScroll:true});
      };
      const save=() => {
        const value=input.value.trim();
        if(!value) {toast("消息不能为空。"); input.focus(); return;}
        if(value !== text) {
          text=value; body.textContent=text;
          if(entry) entry.content=text;
          let mark=bubble.querySelector(".message-edited");
          if(!mark) {mark=document.createElement("span"); mark.className="message-edited"; mark.textContent="已编辑"; tools.prepend(mark);}
        }
        close();
      };
      actions.append(button("取消",close,"message-edit-cancel"),button("保存",save,"message-edit-save"));
      editor.append(input,actions); body.hidden=true; tools.hidden=true; bubble.appendChild(editor);
      state.editing={cancel:close}; updateControls(); input.focus(); input.setSelectionRange(input.value.length,input.value.length);
      input.onkeydown=e => {
        if(e.isComposing) return;
        if(e.key === "Escape") {e.preventDefault(); close();}
        if(e.key === "Enter" && (e.ctrlKey || e.metaKey)) {e.preventDefault(); save();}
      };
    },"message-edit");
    edit.type="button"; edit.title=who === "user" ? "编辑我的消息" : "编辑小狗的消息"; edit.setAttribute("aria-label",edit.title);
    edit.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5M3 21l5-1L21 7a2.1 2.1 0 0 0-5-5L3 15z"/></svg>';
    edit.disabled=!!state.request || !!state.recording || state.transcribing || state.micPending; tools.appendChild(edit);
    const remove=button("",() => {
      if(state.story.busy || state.request || state.recording || state.transcribing || state.micPending || state.editing) return;
      if(entry) for(const list of state.histories.values()) {const index=list.indexOf(entry); if(index !== -1) list.splice(index,1);}
      if(who !== "user") stopSpeech();
      el.remove();
    },"message-delete");
    remove.type="button"; remove.title="删除这条消息"; remove.setAttribute("aria-label",remove.title);
    remove.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6"/></svg>';
    tools.appendChild(remove);
    box.appendChild(el); box.scrollTop=box.scrollHeight;
    return el;
  }
  function offerOceanDeparture(messageElement, start) {
    const bubble=messageElement?.querySelector('.bubble');
    if(!bubble) return;
    const depart=button('出发',() => {depart.remove(); start();},'departure-button');
    depart.type='button'; bubble.appendChild(depart);
    $("#chat").scrollTop=$("#chat").scrollHeight;
  }
  function setAction(id) {
    const normalized=({approach:"happy_hop",wag:"tail_wag",guide:"head_tilt",turn_book:"look_at_portal",idle_sit:"sit"}[id] || id || "idle");
    $$(".scene.on .pet").forEach(pet => pet.dataset.act=normalized);
    $(".scene.on").dataset.act=normalized;
    if(state.scene === "literary") {
      const pose=({head_tilt:"head_tilt",sit:"sit",look_up:"look_up",happy_hop:"happy_tail",tail_wag:"happy_tail",happy_tail:"happy_tail",wag:"happy_tail",run:"walk_r"})[normalized] || "sit";
      $("#petLit img").src=`/assets/desert-reference/dog_${pose}.webp`;
    }
  }
  function action(id) {
    clearTimeout(state.actionTimer); state.actionTimer=null; state.actionToken++;
    setAction(id);
  }
  function playActionSequence(steps, finalAction="idle", onComplete) {
    clearTimeout(state.actionTimer); const token=++state.actionToken;
    const queue=(Array.isArray(steps) ? steps : []).filter(step => step && step[0]);
    let index=0;
    const next=() => {
      if(token !== state.actionToken) return;
      if(index >= queue.length) { state.actionTimer=null; setAction(finalAction); onComplete?.(); return; }
      const [id,duration=650]=queue[index++]; setAction(id);
      state.actionTimer=setTimeout(next,Math.max(120,Number(duration) || 650));
    };
    next();
  }
  function mountPet() {
    $$(".pet-slot").forEach(slot => {slot.dataset.name=state.petName; slot.innerHTML=state.image ? `<img class="pet generated" data-act="idle" src="${esc(state.image)}" alt="${esc(state.petName)}的生成角色">` : window.HXCharacters.defaultPet();});
    $("#petLit").innerHTML='<img class="pet desert-sprite" data-act="idle" src="/assets/desert-reference/dog_sit.webp" alt="沙漠里的小狗">';
    $$(".scene").forEach(el => el.classList.toggle("custom-pet",!!state.image));
  }
  function storyDelay(ms,signal) {
    return new Promise(resolve => {
      const finish=() => {clearTimeout(timer); signal?.removeEventListener("abort",finish); resolve();};
      const timer=setTimeout(finish,ms);
      signal?.addEventListener("abort",finish,{once:true}); if(signal?.aborted) finish();
    });
  }
  function stopStory(leave=false) {
    const story=state.story;
    story.controller?.abort(); story.controller=null;
    if(story.busy) story.phase="paused";
    story.busy=false;
    if(leave) story.phase="inactive";
    $("#storyTransition")?.remove();
    updateStoryControls();
  }
  function updateStoryControls() {
    const story=state.story, bar=$("#storyBar"); if(!bar) return;
    bar.hidden=!["home","ocean"].includes(state.scene);
    $("#storyStatus").textContent=story.busy ? `剧情 ${state.demoConfig.story[story.node]?.id || ""} · ${state.demoConfig.story[story.node]?.title || "出发中"}` :
      ({hesitation:"等你回应美丽…",wish:"告诉美丽，你想去哪里？",paused:"剧情已暂停",complete:"小世界已抵达 · 可以自由聊天",inactive:"自由探索"})[story.phase] || "";
    $("#storyContinue").hidden=story.phase !== "paused";
    $("#storyReplay").textContent=story.busy ? "跳过剧情" : "重播剧情";
  }
  function storyEffect(index) {
    const el=$(".scene.on");
    el.dataset.storyNode=String(index+1);
    if(index === 0) $("#panel").classList.remove("collapsed");
    if(index === 2 || index === 3) el.classList.add("wish-glow");
    if(index === 5) {
      el.classList.add("story-arrival");
      if(!el.querySelector(".story-gulls")) el.insertAdjacentHTML("beforeend",'<div class="story-gulls" aria-hidden="true">'+Array.from({length:3},() => '<span><svg viewBox="0 0 60 24"><path d="M3 7 Q18 2 30 21 Q42 2 57 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></span>').join("")+'</div>');
    }
    if(index === 6) el.classList.add("story-rainbow");
    if(index === 7) el.classList.add("story-closeup");
  }
  async function runStory(start=0,userText="") {
    stopStory();
    const controller=new AbortController(), signal=controller.signal, story=state.story;
    story.controller=controller; story.busy=true; story.phase="running";
    updateControls();
    try {
      for(let index=start;index<8;index++) {
        story.next=index;
        if(index !== start && (index === 1 || index === 3)) {
          story.phase=index === 1 ? "hesitation" : "wish"; break;
        }
        if(index === 5 && state.scene !== "ocean") {
          const transition=document.createElement("div"); transition.id="storyTransition"; transition.setAttribute("aria-hidden","true");
          transition.innerHTML='<div class="wish-orb"></div>'; $("#stage").appendChild(transition);
          await storyDelay(850,signal); if(signal.aborted) return;
          scene("ocean",{storyTransition:true,silent:true});
          await storyDelay(850,signal); if(signal.aborted) return;
          transition.remove();
        }
        if(signal.aborted) return;
        const node=state.demoConfig.story[index], text=index === start && userText ? userText : node.text;
        story.node=index; storyEffect(index); updateStoryControls();
        const entry={role:node.speaker === "主人" ? "user" : "assistant",content:text};
        const storyMessage=message(entry.role === "user" ? "user" : "dog",text,`剧情 ${node.id} · ${node.speaker === "主人" && index !== start ? "主人演示台词" : "预设"}`,entry);
        updateControls();
        const list=history(); list.push(entry); if(list.length > 12) list.splice(0,list.length-12);
        if(index === 3) state.wish=text.slice(0,100);
        const steps=node.action.split("→").map(id => [id.trim(),id.trim() === "run" ? 850 : id.trim() === "jump" ? 750 : 550]);
        const motion=new Promise(resolve => {
          const finish=() => {signal.removeEventListener("abort",finish); resolve();};
          signal.addEventListener("abort",finish,{once:true});
          playActionSequence(steps,state.scene === "ocean" ? "ocean_sit" : "idle",finish);
        });
        const reading=storyDelay(Math.min(4200,Math.max(1300,text.length*95)),signal);
        await Promise.all([motion,reading]);
        if(signal.aborted) return;
        story.next=index+1;
        if(index === 4) {
          story.phase="departure";
          offerOceanDeparture(storyMessage,() => runStory(5));
          break;
        }
        if(index === 6) {await storyDelay(500,signal); if(signal.aborted) return;}
      }
      if(story.next >= 8) story.phase="complete";
    } catch(error) {
      if(!signal.aborted) {story.phase="paused"; toast("剧情暂时中断，请点击继续剧情。");}
    } finally {
      if(story.controller === controller) {
        story.controller=null; story.busy=false; updateControls(); renderQuick(); updateStoryControls();
      }
    }
  }
  function tryStoryInput(text) {
    if(state.scene !== "home") return false;
    const phase=state.story.phase;
    const ocean=/(看海|大海|海边|海洋|玻璃球|七彩)/.test(text) || text === state.demoConfig.story[3].text;
    if(/(不想|不要|算了|读书|小王子|沙漠|自杀|自残|想死|伤害)/.test(text)) {stopStory(true); return false;}
    if(ocean && phase !== "inactive") {runStory(3,text); return true;}
    if(phase === "hesitation") {runStory(1,text); return true;}
    if(phase === "wish") {stopStory(true); return false;}
    return false;
  }
  function stopSpeech() {
    state.speechEpoch++; state.speechRequest?.abort(); state.speechRequest=null;
    if(state.audio) {state.audio.pause(); URL.revokeObjectURL(state.audio.src); state.audio=null;}
    window.speechSynthesis?.cancel();
  }
  async function speak(text) {
    stopSpeech(); const epoch=state.speechEpoch, controller=new AbortController(); state.speechRequest=controller;
    try {
      const blob=await request("/api/voice/synthesize",{text:String(text).slice(0,240)},{binary:true,signal:controller.signal,timeout:40000});
      if(epoch !== state.speechEpoch) return;
      const audio=new Audio(URL.createObjectURL(blob)); state.audio=audio;
      await new Promise((resolve,reject) => {
        let settled=false;
        const finish=error => {
          if(settled) return; settled=true;
          clearTimeout(timer); controller.signal.removeEventListener("abort",cancel);
          audio.onended=null; audio.onerror=null; audio.onpause=null;
          URL.revokeObjectURL(audio.src); if(state.audio === audio) state.audio=null;
          if(error) reject(error); else resolve();
        };
        const cancel=() => {audio.pause(); finish();};
        const timer=setTimeout(cancel,45000);
        audio.onended=() => finish(); audio.onpause=() => finish();
        audio.onerror=() => finish(new Error("语音播放失败。"));
        controller.signal.addEventListener("abort",cancel,{once:true});
        audio.play().catch(finish);
      });
    } catch(error) {
      if(!controller.signal.aborted && epoch === state.speechEpoch) {
        if(state.audio) {state.audio.pause(); URL.revokeObjectURL(state.audio.src); state.audio=null;}
        toast(error.name === "NotAllowedError" ? "浏览器阻止了自动播放，请点击消息旁的朗读按钮。" : `语音播放失败：${error.message || "请稍后重试"}`);
      }
    } finally {if(state.speechRequest === controller) state.speechRequest=null;}
  }
  function updateControls() {
    $("#btnSend").disabled=state.story.busy || !!state.request || state.transcribing || state.micPending || !!state.recording || !!state.editing;
    $("#btnMic").disabled=state.story.busy || !!state.request || state.transcribing || state.micPending || !!state.editing;
    $$(".message-edit,.message-delete,.quick-edit,.quick-action").forEach(el => el.disabled=state.story.busy || !!state.request || !!state.recording || state.transcribing || state.micPending || !!state.editing);
    $("#input").disabled=!!state.recording || state.transcribing;
    $("#btnMic").classList.toggle("recording",!!state.recording);
    $("#btnMic").title=state.recording ? "结束录音并发送" : "语音输入（最长15秒，再点结束）";
    $("#btnMic").setAttribute("aria-label",$("#btnMic").title);
    $("#voiceStatus").textContent=state.recording ? "正在录音，再点麦克风结束（最长15秒）" : state.transcribing ? "正在识别语音…" : state.request ? "旅伴正在回复…" : state.micPending ? "等待麦克风授权…" : "";
    updateStoryControls();
  }
  function startBrowserRecognition(epoch) {
    const Recognition=window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!Recognition) return false;
    const recognition=new Recognition(); let settled=false;
    recognition.lang="zh-CN"; recognition.interimResults=false; recognition.maxAlternatives=1;
    const finish=(error,text="") => {
      if(settled) return; settled=true; clearTimeout(timer);
      if(state.recording?.recognition === recognition) state.recording=null;
      if(epoch !== state.epoch) return;
      updateControls();
      if(error) {toast(error); return;}
      if(text.trim()) {$("#input").value=text.trim(); send(text.trim());}
      else toast("没有识别到说话内容，请重试或使用文字输入。");
    };
    recognition.onresult=event => finish(null,event.results?.[0]?.[0]?.transcript || "");
    recognition.onerror=event => finish(event.error === "not-allowed" ? "浏览器未允许麦克风，请在地址栏中开启麦克风权限。" : "浏览器语音识别失败，请重试或使用文字输入。");
    recognition.onend=() => finish(null,"");
    const timer=setTimeout(() => recognition.stop(),15000);
    state.recording={browser:true,recognition,timer}; state.micPending=false; updateControls();
    try {recognition.start();} catch(error) {finish(error.message || "无法启动浏览器语音识别。");}
    return true;
  }
  function releaseRecording() {
    const rec=state.recording; state.recording=null; if(!rec) return null;
    if(rec.browser) {clearTimeout(rec.timer); try {rec.recognition.stop();} catch(_) {} return null;}
    clearTimeout(rec.timer); rec.processor.disconnect(); rec.source.disconnect(); rec.gain.disconnect();
    rec.stream.getTracks().forEach(t => t.stop()); rec.context.close().catch(() => {}); return rec;
  }
  function cancelInteraction(preserveStory=false) {
    if(!preserveStory) stopStory();
    state.editing?.cancel();
    clearTimeout(state.actionTimer); state.actionTimer=null; state.actionToken++;
    state.epoch++; state.request?.abort(); state.request=null;
    releaseRecording(); state.micPending=false; state.transcribing=false; stopSpeech(); updateControls();
  }
  async function send(text) {
    if(state.editing) {toast("请先保存或取消正在编辑的消息。"); return;}
    text=String(text || "").trim(); if(!text || state.story.busy || state.request || state.recording || state.transcribing || state.micPending) return;
    if(text.length > 500) {toast("一次最多输入500字。"); return;}
    if(tryStoryInput(text)) {$("#input").value=""; selectTab("chat"); return;}
    stopSpeech(); const controller=new AbortController(), epoch=state.epoch, prior=history().slice(-6);
    const userEntry={role:"user",content:text};
    state.request=controller; updateControls(); selectTab("chat"); message("user",text,"",userEntry); $("#input").value="";
    try {
      const reply=await request("/api/chat",{scene_id:sceneId(),view_id:state.view,hotspot_id:state.hotspot,
        pet_id:state.petId,nickname:state.petName,message:text,history:prior,session_context:{wish:state.wish,family_note:state.familyNote}},{signal:controller.signal});
      if(state.epoch !== epoch) return;
      const source=reply.source === "qwen" ? "千问 · 实时回复" : `本地预设${reply.fallback_reason ? " · "+(reasons[reply.fallback_reason] || "服务暂不可用") : ""}`;
      const assistantEntry={role:"assistant",content:reply.dialogue};
      const replyMessage=message("dog",reply.dialogue,source,assistantEntry);
      const list=history(); list.push(userEntry,assistantEntry); if(list.length > 12) list.splice(0,list.length-12);
      action(reply.action); renderQuick(reply.suggestions);
      if(["home","ocean","desert"].includes(reply.transition)) {
        if(reply.transition === "ocean" && state.scene === "home") state.wish=text.slice(0,100);
        state.request=null;
        if(reply.transition === "ocean" && state.scene === "home") {offerOceanDeparture(replyMessage,() => scene("ocean")); updateControls();}
        else scene(reply.transition === "desert" ? "study" : reply.transition);
      }
    } catch(error) {if(!controller.signal.aborted && state.epoch === epoch) {message("dog","这次没能连接上服务，请稍后重试。","连接失败"); toast(error.message);}}
    finally {if(state.request === controller) {state.request=null; updateControls();}}
  }
  function button(text,run,className="") {const el=document.createElement("button"); el.textContent=text; el.className=className; el.onclick=run; return el;}
  function quickKey(id) {return `${state.scene}/${state.view}/${state.hotspot}/${id}`;}
  function quickItem(id,label,run,iconName="") {
    const wrapper=document.createElement("div"); wrapper.className="quick-item"; wrapper.dataset.quickId=id;
    const actionButton=button("",run,"quick-action"), text=state.quickEdits.get(quickKey(id)) || label;
    actionButton.onclick=() => run(text); actionButton.innerHTML=`${iconName ? icon(iconName) : ""}<span>${esc(text)}</span>`;
    const edit=button("",() => editQuick(id,label),"quick-edit");
    edit.type="button"; edit.title="编辑这条对话引导"; edit.setAttribute("aria-label",edit.title);
    edit.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5M3 21l5-1L21 7a2.1 2.1 0 0 0-5-5L3 15z"/></svg>';
    edit.disabled=!!state.request || !!state.recording || state.transcribing || state.micPending;
    wrapper.append(actionButton,edit); return wrapper;
  }
  function editQuick(id,label) {
    if(state.request || state.recording || state.transcribing || state.micPending) return;
    state.editing?.cancel(); stopSpeech();
    const key=quickKey(id), wrapper=[...$("#quick").children].find(el => el.dataset.quickId === id);
    if(!wrapper) return;
    const editor=document.createElement("div"); editor.className="quick-editor";
    const input=document.createElement("textarea"); input.className="quick-edit-input"; input.value=state.quickEdits.get(key) || label;
    input.maxLength=240; input.rows=2; input.setAttribute("aria-label","编辑对话引导");
    const actions=document.createElement("div"); actions.className="message-edit-actions";
    const close=save => {
      if(save) {
        const value=input.value.trim();
        if(!value) {toast("引导内容不能为空。"); input.focus(); return;}
        state.quickEdits.set(key,value);
      }
      editor.remove(); state.editing=null; renderQuick(); updateControls();
    };
    actions.append(button("取消",() => close(false),"message-edit-cancel"),button("保存",() => close(true),"message-edit-save"));
    editor.append(input,actions); wrapper.replaceWith(editor);
    state.editing={cancel:() => close(false)}; updateControls(); input.focus(); input.select();
    input.onkeydown=e => {
      if(e.isComposing) return;
      if(e.key === "Escape") {e.preventDefault(); close(false);}
      if(e.key === "Enter" && (e.ctrlKey || e.metaKey)) {e.preventDefault(); close(true);}
    };
  }
  function renderQuick(suggestions) {
    if(suggestions !== undefined) state.quickSuggestions=Array.isArray(suggestions) ? suggestions : [];
    suggestions=state.quickSuggestions;
    const box=$("#quick"); box.replaceChildren();
    if(state.scene === "study") {box.appendChild(quickItem("explore","好呀！",value => startPortal(value),"book")); return;}
    if(state.scene === "literary") {
      const ids=["tree","well","stars"], step=state.literaryStep;
      if(step < 6) {
        const entry=window.HXLiterary.hotspots[ids[Math.floor(step/2)]];
        box.appendChild(quickItem(`literary-step-${step}`,step%2 ? "继续" : entry.childLine,value => advanceLiterary(value)));
      }
      return;
    }
    if(state.scene === "home") {
      if(["hesitation","wish"].includes(state.story.phase)) {
        const index=state.story.phase === "hesitation" ? 1 : 3;
        box.appendChild(quickItem(`story-${index}`,state.demoConfig.story[index].text,value => send(value),index === 1 ? "chat" : "cloud"));
      }
      const items=[
        ["miss",demoQuick("home","miss","爸爸妈妈出差了，我有点想他们"),value => send(value),"heart"],
        ["wish",demoQuick("home","wish","我有一个愿望想实现……"),() => openContext("wish"),"cloud"],
        ["book",demoQuick("home","book","我想和你一起读《小王子》……"),() => scene("study"),"book"],
        ["self",demoQuick("home","self","我想自己说……"),() => $("#input").focus(),"chat"]
      ];
      items.forEach(([id,label,run,iconName]) => box.appendChild(quickItem(id,label,run,iconName)));
      updateControls();
      return;
    }
    const questions=state.content?.culture_cards[state.hotspot]?.quick_questions || sceneData()?.quick_questions || ["我有点想爸爸妈妈","我想坐玻璃球看海"];
    questions.slice(0,2).forEach((text,index) => box.appendChild(quickItem(`question-${index}`,demoQuick(state.scene,`question${index}`,text),value => send(value))));
    suggestions.forEach(id => {const title=state.content?.targets[id]; if(title) box.appendChild(quickItem(`target-${id}`,title,() => target(id)));});
  }
  function target(id) {
    if(["tree","well","stars"].includes(id)) {if(state.scene !== "literary") scene("literary"); culture(id);}
    else if(id === "inside") setView(state.view === "inside" ? "outside" : "inside");
    else if(id === "desert") scene("study"); else if(["home","ocean"].includes(id)) scene(id);
  }
  function scene(name,{storyTransition=false,silent=false}={}) {
    if(name === "culture") name="study";
    if(name === "desert") name="literary";
    if(!["home","ocean","study","literary"].includes(name)) return;
    stopDesert(); stopPortal();
    cancelInteraction(storyTransition); if(!storyTransition) stopStory(true);
    state.histories.clear(); $("#chat").replaceChildren();
    $(".culture-card")?.remove(); closeWorldEntrance(); state.scene=name; state.hotspot=""; state.view=name === "ocean" ? "outside" : "default"; state.quickSuggestions=[];
    $$(".scene").forEach(el => {el.classList.remove("wish-glow","story-arrival","story-rainbow","story-closeup"); delete el.dataset.storyNode; el.querySelector(".story-gulls")?.remove();});
    $$(".scene").forEach(el => {const active=el.dataset.sceneName === name; el.classList.toggle("on",active); el.setAttribute("aria-hidden",String(!active)); el.inert=!active;});
    $$("#nav button").forEach(el => {const active=el.dataset.scene === (isCulture() ? "culture" : name); el.classList.toggle("on",active); el.setAttribute("aria-pressed",String(active));});
    if(name === "literary") {state.literaryStep=0; desert.x=47; $("#childLit").style.left=""; $("#petLit").style.left=""; desertPose("idle","sit");}
    action(name === "ocean" ? "ocean_sit" : "idle"); $("#input").placeholder=sceneData()?.placeholder || "输入你想说的话…";
    if(name === "literary") desertPose("idle","sit");
    $("#contextCaption").textContent=sceneData()?.caption || "";
    $("#contextCaption").hidden=isCulture(); $("#dockLeft").hidden=isCulture();
    $("#wishCaption").textContent=state.wish ? `我的愿望：${state.wish}` : "坐进七彩玻璃球，让想象带你看海。";
    $(".scene--ocean").classList.remove("inside"); $("#credit").classList.toggle("on",isCulture());
    $("#speed").classList.remove("on"); moveSphere(0); renderDock(); renderQuick(); selectTab("chat");
    if(!silent && name === "home") runStory(0);
    else if(!silent && name === "study") {action("head_tilt"); const text=demoOpening(name,window.HXLiterary.opening); message("dog",text,"故事对话 · 预设");}
    else if(!silent && name !== "literary") message("dog",demoOpening(name,sceneData()?.opening || "今天想跟我说些什么？"),"场景引导 · 预设");
    updateControls();
  }
  function startPortal(reply="好呀！") {
    if(state.scene !== "study" || portalActive) return;
    cancelInteraction(); message("user",typeof reply === "string" ? reply : "好呀！"); action("tail_wag"); portalActive=true;
    const overlay=$("#pageTurn"), frame=$("#princePortalFrame");
    overlay.classList.add("on"); overlay.setAttribute("aria-hidden","false");
    window.dispatchEvent(new CustomEvent("portal_start"));
    try {
      if(!window.LittlePrinceBook) throw new Error("书本动画加载失败");
      frame.addEventListener("prince:complete",finishPortal,{once:true});
      portalBook=new window.LittlePrinceBook(frame,{autoplay:false,interactive:false});
      const book=portalBook;
      portalLoadingTimer=setTimeout(() => {if(portalBook === book) {toast("书本动画加载较慢，已进入沙漠。"); finishPortal();}},15000);
      book.ready.then(() => {
        if(portalBook !== book || !portalActive) return;
        clearTimeout(portalLoadingTimer); portalLoadingTimer=null; book.play();
      }).catch(() => {if(portalBook === book) {toast("书本动画加载失败，已进入沙漠。"); finishPortal();}});
    } catch(_) {toast("书本动画加载失败，已进入沙漠。"); finishPortal();}
  }
  function stopPortal() {
    portalActive=false; clearTimeout(portalLoadingTimer); portalLoadingTimer=null;
    const frame=$("#princePortalFrame"); frame?.removeEventListener("prince:complete",finishPortal);
    portalBook?.destroy(); portalBook=null;
    const overlay=$("#pageTurn"); overlay?.classList.remove("on"); overlay?.setAttribute("aria-hidden","true");
  }
  function finishPortal() {
    if(!portalActive) return;
    stopPortal(); scene("literary");
  }
  function setView(view) {
    cancelInteraction(); state.view=view; state.quickSuggestions=[]; $(".scene--ocean").classList.toggle("inside",view === "inside");
    $("#contextCaption").textContent=view === "inside" ? "玻璃球内 · 和旅伴一起看海" : "玻璃球外 · 海风托起了一点想象";
    renderDock(); renderQuick(); toast(view === "inside" ? "已经坐进玻璃球" : "回到玻璃球外部");
  }
  function renderDock() {
    if(isCulture()) {$("#dock").replaceChildren(); return;}
    const actions=state.scene === "home" ? [
      ["paw","抚摸",() => {playActionSequence([["pet_react",650],["happy_tail",1100]],"idle"); message("dog",demoInteraction("pet","嘿嘿，你的手好暖。"),"互动预设");}],
      ["play","和我玩",() => {playActionSequence([["stand",350],["run",850],["happy_hop",750],["run",850]],"idle"); message("dog",demoInteraction("play","来，一起跳一下！"),"互动预设");}],
      ["sit","一起坐下",() => {playActionSequence([["sit",850]],"idle_sit"); message("dog",demoInteraction("sit","那我们就坐一会儿。"),"互动预设");}],
      ["sparkle","实现愿望",() => openContext("wish")]
    ] : state.scene === "ocean" ? [
      ["left","向左",() => moveSphere(-1)],["right","向右",() => moveSphere(1)],
      ["fly","飞翔",() => {state.flying=!state.flying; moveSphere(0);}],
      ["view",state.view === "inside" ? "球外视角" : "坐进球内",() => setView(state.view === "inside" ? "outside" : "inside")],["home","回家",() => scene("home")]
    ] : state.scene === "study" ? [["book","去探索",() => scene("literary")],["home","回家",() => scene("home")]]
      : [["book","猴面包树",() => culture("tree")],["compass","沙漠水井",() => culture("well")],["book","回到树下",() => scene("study")],["home","回家",() => scene("home")]];
    $("#dock").replaceChildren(); actions.forEach(([ic,label,run]) => {const el=button("",() => {if(state.story.busy) cancelInteraction(); run();}); el.innerHTML=`<span class="disc">${icon(ic)}</span><span>${label}</span>`; $("#dock").appendChild(el);});
  }
  function moveSphere(direction) {
    state.sphereX=Math.max(-22,Math.min(22,state.sphereX+direction*7));
    $("#sphereRig").style.transform=`translate(calc(-50% + ${state.sphereX}%), calc(-50% + ${state.flying ? -12 : 0}%)) rotate(${state.sphereX*.14}deg)`;
    $("#bgOcean").style.transform=`translate(${-state.sphereX*.18}%, ${state.flying ? 2 : 0}%) scale(1.14)`;
    $("#speed").classList.toggle("on",state.scene === "ocean" && state.flying);
  }
  function desertPose(child,dog) {
    $("#childLit img").src=`/assets/desert-reference/child_${child}.webp`;
    $("#petLit img").src=`/assets/desert-reference/dog_${dog}.webp`;
  }
  function stopDesert() {
    desert.token++; desert.busy=false;
    $("#childLit")?.classList.remove("desert-walking"); $("#petLit")?.classList.remove("desert-walking");
  }
  function desertWait(ms,token) {
    return new Promise(resolve => setTimeout(() => resolve(token === desert.token && state.scene === "literary"),ms));
  }
  async function walkDesert(x,token) {
    x=Math.max(20,Math.min(70,x));
    const direction=x < desert.x ? "l" : "r";
    desertPose(`walk_${direction}`,`walk_${direction}`);
    const child=$("#childLit"), dog=$("#petLit");
    child.classList.add("desert-walking"); dog.classList.add("desert-walking");
    child.style.left=`${Math.max(12,x-8)}%`; dog.style.left=`${x}%`; desert.x=x;
    if(!await desertWait(900,token)) return false;
    child.classList.remove("desert-walking"); dog.classList.remove("desert-walking"); desertPose("idle","sit");
    return true;
  }
  async function advanceLiterary(text) {
    if(state.scene !== "literary" || desert.busy || state.literaryStep >= 6) return;
    const step=state.literaryStep, ids=["tree","well","stars"], id=ids[Math.floor(step/2)];
    const entry=window.HXLiterary.hotspots[id];
    if(!entry?.enabled) return;
    cancelInteraction(); closeWorldEntrance(); selectTab("chat");
    desert.busy=true; const token=++desert.token;
    if(step%2 === 0) {
      state.hotspot=id;
      if(!await walkDesert(({tree:36,well:70,stars:55})[id],token)) return;
      if(!await desertWait(260,token)) return;
      desertPose(({tree:"look_up",well:"sit",stars:"look_up"})[id],({tree:"head_tilt",well:"sit",stars:"look_up"})[id]);
      $$("[data-hotspot]").forEach(el => el.classList.toggle("selected",el.dataset.hotspot === id));
      message("user",text || entry.childLine);
    } else {
      message("dog",entry.dogLine,"故事对话 · 预设");
      action(entry.dogAction);
      if(token !== desert.token || state.scene !== "literary") return;
    }
    state.literaryStep=step+1; desert.busy=false; renderQuick();
    if(step === 5) showWorldEntrance();
  }
  async function culture(id) {
    if(state.scene !== "literary" || desert.busy) return;
    const entry=window.HXLiterary.hotspots[id]; if(!entry?.enabled) return;
    cancelInteraction(); state.hotspot=id; state.quickSuggestions=[]; renderQuick(); closeWorldEntrance(); selectTab("chat");
    desert.busy=true; const token=++desert.token;
    if(!await walkDesert(({tree:36,well:70,stars:55})[id],token)) return;
    if(!await desertWait(260,token)) return;
    const childPose=({tree:"point",well:"sit",stars:"look_up"})[id] || "idle";
    const dogPose=({tree:"head_tilt",well:"sit",stars:"look_up"})[id] || "sit";
    desertPose(childPose,dogPose);
    $$("[data-hotspot]").forEach(el => el.classList.toggle("selected",el.dataset.hotspot === id));
    message("user",entry.childLine);
    if(!await desertWait(420,token)) return;
    message("dog",entry.dogLine,"故事对话 · 预设");
    if(token !== desert.token || state.scene !== "literary") return;
    if(id === "stars") {desertPose("cheer","wave"); if(!await desertWait(400,token)) return;}
    state.literaryStep=({tree:2,well:4,stars:6})[id]; desert.busy=false; renderQuick();
    if(entry.nextAction === "worlds") showWorldEntrance();
  }
  function loadCultureBook() {
    if(window.CultureScene) return Promise.resolve();
    if(!cultureBookLoading) {
      cultureBookLoading=new Promise((resolve,reject) => {
        const script=document.createElement("script"); script.src="/culture-book.js?v=20261106-book-1";
        script.onload=() => window.CultureScene ? resolve() : reject(new Error("文化动效未能初始化。"));
        script.onerror=() => {script.remove(); reject(new Error("文化动效加载失败，请重试。"));};
        document.head.appendChild(script);
      }).catch(error => {cultureBookLoading=null; throw error;});
    }
    return cultureBookLoading;
  }
  function closeWorldEntrance() {
    if(!worldEntrance) return;
    worldEntrance.resize?.disconnect(); worldEntrance.scene?.destroy(); worldEntrance.el.remove(); worldEntrance=null;
  }
  function showWorldEntrance() {
    closeWorldEntrance();
    const el=document.createElement("div"); el.id="worldEntrance"; el.className="world-entrance";
    el.innerHTML='<div class="world-culture-viewport"><div class="world-culture-frame"></div></div><p class="world-culture-hint" role="status">正在准备星空…</p>';
    const current={el,scene:null,resize:null}; worldEntrance=current;
    const viewport=el.querySelector(".world-culture-viewport"), frame=el.querySelector(".world-culture-frame"), hint=el.querySelector(".world-culture-hint");
    const controls=document.createElement("div"); controls.className="world-entrance-controls";
    const pause=button("暂停",() => current.scene?.state === "playing" ? current.scene.pause() : current.scene?.resume(),"btn world-pause"); pause.hidden=true;
    const reset=button("重新开始",() => current.scene?.reset(),"btn world-reset"); reset.hidden=true;
    const retry=button("重新加载",() => showWorldEntrance(),"btn world-retry"); retry.hidden=true;
    controls.append(button("返回沙漠",closeWorldEntrance,"btn world-back"),pause,reset,retry,button("探索更多世界",() => selectTab("explore"),"btn"));
    el.appendChild(controls); $(".scene--literary").appendChild(el);
    loadCultureBook().then(async () => {
      if(worldEntrance !== current) return;
      const animation=new window.CultureScene(frame); current.scene=animation;
      const fit=() => {
        const {width,height}=viewport.getBoundingClientRect(), ratio=animation.data.width/animation.data.height;
        const w=matchMedia("(max-width:600px)").matches ? Math.min(width,height*ratio) : Math.max(width,height*ratio);
        frame.style.width=`${w}px`; frame.style.height=`${w/ratio}px`;
      };
      current.resize=new ResizeObserver(fit); current.resize.observe(viewport); fit();
      const update=() => {
        hint.textContent=({idle:"点击中间的书，开启文化之旅",playing:"星光展开，文化世界正在依次浮现…",paused:"动效已暂停，点击继续",complete:"每一颗星星，都藏着一段故事。"})[animation.state] || "正在准备星空…";
        pause.hidden=!["playing","paused"].includes(animation.state); pause.textContent=animation.state === "paused" ? "继续" : "暂停";
        reset.hidden=!["playing","paused","complete"].includes(animation.state);
      };
      ["ready","start","pause","resume","reset","complete"].forEach(name => frame.addEventListener("culture:"+name,update));
      await animation.ready;
      if(worldEntrance === current) update();
    }).catch(error => {
      if(worldEntrance !== current) return;
      hint.textContent="星空暂时加载失败，请点击重新加载。"; retry.hidden=false; toast(error.message);
    });
  }
  function selectTab(tab) {
    $$(".tab").forEach(el => el.classList.toggle("on",el.dataset.tab === tab));
    $("#chat").style.display=tab === "chat" ? "flex" : "none"; $("#chatFoot").style.display=tab === "chat" ? "block" : "none";
    $("#explore").style.display=tab === "explore" ? "flex" : "none";
  }
  function openContext(kind) {
    cancelInteraction(); state.contextKind=kind;
    $("#contextTitle").textContent=kind === "wish" ? "写下一个小愿望" : "给想念的家人留句话";
    $("#contextText").value=kind === "wish" ? state.wish : state.familyNote;
    $("#contextHint").textContent=kind === "wish" ? "这次先坐玻璃球去看海。愿望会带入本次对话。" : "纸条只留在本次体验中，也会作为旅伴对话的上下文，不会发送给家人。";
    $("#contextSave").textContent=kind === "wish" ? "带着愿望去看海" : "留下纸条";
    $("#contextModal").classList.add("on"); $("#contextText").focus();
  }
  async function mic() {
    if(state.recording) {if(state.recording.browser) {try {state.recording.recognition.stop();} catch(_) {} } else finishMic(); return;} if(state.story.busy || state.request || state.transcribing || state.micPending) return;
    stopSpeech(); state.micPending=true; updateControls(); const epoch=state.epoch; let stream,context;
    try {
      if(!navigator.mediaDevices?.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) {
        if(startBrowserRecognition(epoch)) return;
        throw new Error("当前浏览器不支持语音输入，请使用最新版 Edge 或 Chrome，或改用文字输入。");
      }
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      if(epoch !== state.epoch) {stream.getTracks().forEach(t => t.stop()); return;}
      context=new (window.AudioContext || window.webkitAudioContext)(); await context.resume();
      if(epoch !== state.epoch) {stream.getTracks().forEach(t => t.stop()); await context.close(); return;}
      const source=context.createMediaStreamSource(stream), processor=context.createScriptProcessor(4096,1,1), gain=context.createGain(); gain.gain.value=0;
      const rec={context,stream,source,processor,gain,chunks:[],count:0};
      processor.onaudioprocess=event => {
        const input=event.inputBuffer.getChannelData(0), remaining=Math.ceil(context.sampleRate*15)-rec.count;
        if(remaining > 0) {const chunk=input.slice(0,remaining); rec.chunks.push(chunk); rec.count+=chunk.length;}
        if(rec.count >= context.sampleRate*15 && state.recording === rec) finishMic();
      };
      source.connect(processor); processor.connect(gain); gain.connect(context.destination);
      state.recording=rec; rec.timer=setTimeout(finishMic,15000);
    } catch(error) {
      stream?.getTracks().forEach(t => t.stop()); context?.close().catch(() => {});
      if(epoch === state.epoch) toast(error.name === "NotAllowedError" ? "麦克风未授权，请在浏览器中允许后重试。" : error.message || "无法启动麦克风。");
    } finally {if(epoch === state.epoch) {state.micPending=false; updateControls();}}
  }
  async function finishMic() {
    const rec=releaseRecording(); if(!rec) return;
    const epoch=state.epoch,controller=new AbortController(); state.request=controller; state.transcribing=true; updateControls();
    try {
      if(rec.count/rec.context.sampleRate < 0.3) throw new Error("录音太短，请说完一句话再结束。");
      const samples=new Float32Array(rec.count); let offset=0; rec.chunks.forEach(chunk => {samples.set(chunk,offset); offset+=chunk.length;});
      const encoded=await readFile(new Blob([window.HXAudio.encodeWav(samples,rec.context.sampleRate)],{type:"audio/wav"}));
      const result=await request("/api/voice/transcribe",{mime_type:"audio/wav",audio_base64:encoded.split(",")[1]},{signal:controller.signal,timeout:45000});
      if(epoch !== state.epoch) return;
      state.request=null; state.transcribing=false; updateControls();
      if(result.text?.trim()) {$("#input").value=result.text; await send(result.text);} else toast("没有识别到文字，请重试或使用文字输入。");
    } catch(error) {if(!controller.signal.aborted && epoch === state.epoch) toast(error.message);}
    finally {if(state.request === controller) {state.request=null; state.transcribing=false; updateControls();}}
  }
  const readFile=file => new Promise((resolve,reject) => {const reader=new FileReader(); reader.onload=() => resolve(reader.result); reader.onerror=() => reject(new Error("读取文件失败。")); reader.readAsDataURL(file);});
  function resetPetSelection() {state.pendingPet=null; $("#btnConfirm").disabled=true; $("#btnGen").textContent="2. 生成我的旅伴";}
  async function generatePet() {
    const file=$("#petFile").files?.[0]; if(!file) return;
    const ticket=++state.generation; resetPetSelection(); ["#btnGen","#btnPick","#introName"].forEach(s => $(s).disabled=true);
    $("#btnGen").textContent="生成中…"; $("#previewBox").classList.add("scanning"); $("#previewCap").textContent="正在生成，通常需要几十秒…";
    try {
      const nickname=$("#introName").value.trim() || "美丽";
      let pet=await request("/pet/generate",{nickname,pet_image:await readFile(file)}); const deadline=Date.now()+180000;
      while(pet.status === "generating" && Date.now() < deadline && ticket === state.generation) {await new Promise(resolve => setTimeout(resolve,1200)); pet=await request("/api/pets/"+pet.pet_id);}
      if(ticket !== state.generation) return;
      if(pet.status !== "ready") throw new Error(pet.error || "生成等待超时，可稍后重新打开旅伴设置再试。");
      if(!/^\/api\/pets\/[a-f0-9]{32}\/image$/.test(pet.image_url)) throw new Error("生成图像地址无效。");
      await new Promise((resolve,reject) => {const probe=new Image(); probe.onload=resolve; probe.onerror=() => reject(new Error("角色已生成，但图片加载失败，请重试。")); probe.src=pet.image_url;});
      if(ticket !== state.generation) return;
      state.pendingPet=pet; $("#previewImg").src=pet.image_url; $("#previewBox").classList.add("hasimg");
      $("#previewCap").textContent="千问生成成功 · 确认后应用到所有场景"; $("#btnGen").textContent="2. 已生成 ✓"; $("#btnConfirm").disabled=false;
    } catch(error) {if(ticket === state.generation) {$("#previewCap").textContent=error.message; $("#btnGen").textContent="2. 重新生成"; toast(error.message);}}
    finally {if(ticket === state.generation) {$("#previewBox").classList.remove("scanning"); ["#btnGen","#btnPick","#introName"].forEach(s => $(s).disabled=false);}}
  }
  function enterHome(generated,startScene="home") {
    if(generated && !state.pendingPet) return; cancelInteraction(); state.generation++;
    state.petName=generated ? state.pendingPet.nickname : $("#introName").value.trim() || "美丽";
    state.petId=generated ? state.pendingPet.pet_id : ""; state.image=generated ? state.pendingPet.image_url : "";
    state.histories.clear(); $("#chat").replaceChildren(); mountPet(); $("#intro").classList.remove("on"); $("#intro").style.display="none";
    state.entered=true; scene(["home","ocean","culture","study","literary","desert"].includes(startScene) ? startScene : "home");
  }
  async function refreshHealth() {
    $("#serviceStatus").textContent="正在检查…";
    try {
      const health=await request("/health"); $("#serviceStatus").replaceChildren();
      Object.entries({chat:"文字对话",image:"宠物生图",asr:"语音识别",tts:"语音朗读"}).forEach(([kind,label]) => {
        const value=health.services?.[kind],configured=health[kind === "chat" ? "chat_configured" : kind === "image" ? "image_configured" : "voice_configured"];
        const description=!configured ? "未配置" : value?.state === "ready" ? "最近调用成功" : value?.state === "unavailable" ? reasons[value.reason] || "暂不可用" : "已配置，待验证";
        const row=document.createElement("p"); row.textContent=`${label}：${description}`; $("#serviceStatus").appendChild(row);
      });
    } catch(error) {$("#serviceStatus").textContent=error.message;}
  }
  function renderSettings() {
    const box=$("#modalSet .box");
    box.innerHTML='<h3>演示设置 · 台词可编辑</h3><p class="hint">这里只编辑显示文案；动作、快捷按钮的行为和场景转场仍由固定流程控制。修改会保存在本机浏览器。</p><div class="settings-scroll"><section class="line-editor-section"><h4>场景开场</h4><div id="openingEditor"></div></section><section class="line-editor-section"><h4>家庭剧情 01—08</h4><div id="storyEditor"></div></section><section class="line-editor-section"><h4>快捷引导</h4><div id="quickEditorSettings"></div></section><section class="line-editor-section"><h4>旅伴互动回复</h4><div id="interactionEditor"></div></section><section class="line-editor-section"><h4>服务状态</h4><div id="serviceStatus">点击刷新状态检查后端服务。</div><button class="btn" id="refreshServices" type="button">刷新状态</button></section></div><div class="row"><button class="btn" id="btnResetLines" type="button">恢复默认</button><button class="btn" id="btnReset" type="button">重播剧情</button><button class="btn" id="openPet" type="button">更换旅伴</button><button class="btn pri" id="btnSaveLines" type="button">保存并关闭</button></div>';
    const openingNames={home:"家庭",ocean:"心象之境",study:"书页入口",literary:"文脉之境"};
    Object.entries(state.demoConfig.openings).forEach(([sceneName,text]) => {
      const row=document.createElement("label"); row.className="line-editor-row"; row.innerHTML=`<span>${esc(openingNames[sceneName] || sceneName)}</span><textarea data-opening="${esc(sceneName)}" maxlength="240">${esc(text)}</textarea>`; $("#openingEditor").appendChild(row);
    });
    state.demoConfig.story.forEach((item,index) => {
      const row=document.createElement("label"); row.className="line-editor-row story-row"; row.innerHTML=`<span><b>${esc(item.id)} · ${esc(item.title)}</b><small>${esc(item.speaker)} · 动作 ${esc(item.action)}${item.transition ? ` · 转场 ${esc(item.transition)}` : ""}</small></span><textarea data-story="${index}" maxlength="240">${esc(item.text)}</textarea>`; $("#storyEditor").appendChild(row);
    });
    const quickNames={miss:"想念家人",wish:"愿望",book:"打开书",self:"自由输入",question0:"引导一",question1:"引导二"};
    Object.entries(state.demoConfig.quick).forEach(([sceneName,items]) => Object.entries(items).forEach(([id,text]) => {
      const row=document.createElement("label"); row.className="line-editor-row"; row.innerHTML=`<span>${esc(sceneName)} · ${esc(quickNames[id] || id)}</span><textarea data-quick-scene="${esc(sceneName)}" data-quick-id="${esc(id)}" maxlength="120">${esc(text)}</textarea>`; $("#quickEditorSettings").appendChild(row);
    }));
    const interactionNames={pet:"抚摸",play:"和我玩",sit:"一起坐下",tilt:"歪头回应"};
    Object.entries(state.demoConfig.interactions).forEach(([id,text]) => {
      const row=document.createElement("label"); row.className="line-editor-row"; row.innerHTML=`<span>${esc(interactionNames[id] || id)}</span><textarea data-interaction="${esc(id)}" maxlength="120">${esc(text)}</textarea>`; $("#interactionEditor").appendChild(row);
    });
    $("#refreshServices").onclick=refreshHealth;
    $("#btnResetLines").onclick=() => {state.demoConfig=cloneDemoConfig(); state.quickEdits.clear(); renderSettings(); toast("已恢复默认台词，请点击保存并关闭应用。");};
    $("#btnReset").onclick=() => {$("#modalSet").classList.remove("on"); replayStory();};
    $("#btnSaveLines").onclick=() => {
      $$("[data-opening]").forEach(el => {const value=el.value.trim(); if(value) state.demoConfig.openings[el.dataset.opening]=value;});
      $$("[data-story]").forEach(el => {const value=el.value.trim(); if(value) state.demoConfig.story[Number(el.dataset.story)].text=value;});
      const homeOpening=state.demoConfig.story[0]?.text?.trim();
      if(homeOpening) state.demoConfig.openings.home=homeOpening;
      $$("[data-quick-scene]").forEach(el => {const value=el.value.trim(); if(value) state.demoConfig.quick[el.dataset.quickScene][el.dataset.quickId]=value;});
      $$("[data-interaction]").forEach(el => {const value=el.value.trim(); if(value) state.demoConfig.interactions[el.dataset.interaction]=value;});
      saveDemoConfig(); renderQuick(); $("#modalSet").classList.remove("on"); toast("台词已保存到本机浏览器。");
    };
    $("#openPet").onclick=() => {$("#modalSet").classList.remove("on"); $("#intro").style.display="flex"; $("#intro").classList.add("on"); resetPetSelection(); $("#petFile").value=""; $("#btnGen").disabled=true; $("#btnPick").disabled=false; $("#introName").disabled=false; $("#previewBox").classList.remove("hasimg","scanning"); $("#previewCap").textContent="选择照片生成，或使用演示旅伴";};
  }
  function replayStory() {
    cancelInteraction(); state.histories.clear(); $("#chat").replaceChildren(); scene("home");
  }
  function initialize() {
    $$("svg use").forEach(use => use.parentElement.setAttribute("viewBox","0 0 24 24"));
    $(".brand").innerHTML='<strong>心之所向</strong><small>HEARTWARD</small>';
    $("#sphereRig").insertAdjacentHTML("beforeend",'<div class="ocean-actors"><div class="child" id="childOcean"></div><div class="pet-slot" id="petOcean"></div></div>');
    ["#childHome","#childStudy","#childLit","#childOcean"].forEach(sel => $(sel).innerHTML=window.HXCharacters.childSVG(sel === "#childOcean" ? "ocean" : "home"));
    $("#childLit").innerHTML='<img class="desert-sprite" src="/assets/desert-reference/child_idle.webp" alt="沙漠里的小主人">';
    $("#childOcean").innerHTML='<img class="ocean-child-art" src="/assets/latest/kids.webp" alt="小主人坐在玻璃球中看海">';
    $("#previewPet").innerHTML=window.HXCharacters.defaultPet(); $("#previewCap").textContent="未上传时可直接使用演示旅伴";
    ["home","ocean"].forEach(name => $(".scene--"+name).classList.add("has-art"));
    ["#bgHome","#bgOcean"].forEach(sel => $(sel).classList.add("ready"));
    $$("[data-lit]").forEach(el => {const id=({baobab:"tree",well:"well",star:"stars"})[el.dataset.lit]; if(id) el.dataset.hotspot=id;});
    mountPet();
    $("#stage").insertAdjacentHTML("beforeend",'<p id="contextCaption" class="context-caption"></p>');
    $(".scene--ocean").insertAdjacentHTML("beforeend",'<p id="wishCaption" class="wish-caption"></p>');
    $("#chatFoot").insertAdjacentHTML("afterbegin",'<div id="voiceStatus" role="status"></div>');
    $("#chatFoot").insertAdjacentHTML("afterbegin",'<div id="storyBar" class="story-bar"><span id="storyStatus" role="status"></span><button id="storyContinue" type="button" hidden>继续剧情</button><button id="storyReplay" type="button">重播剧情</button></div>');
    $("#storyContinue").onclick=() => runStory(state.story.next);
    $("#storyReplay").onclick=() => {
      if(state.story.busy) {cancelInteraction(); stopStory(true); renderQuick(); updateControls();}
      else replayStory();
    };
    $("#chat").setAttribute("role","log"); $("#chat").setAttribute("aria-live","polite"); $("#toast").setAttribute("role","status");
    $("#input").maxLength=500; $("#input").setAttribute("aria-label","与旅伴对话");
    $("#hsBook b").textContent="翻开《小王子》"; $("#hsBook").setAttribute("aria-label","翻开《小王子》");
    $(".scene--home").insertAdjacentHTML("beforeend",'<button class="family-photo" id="hsFamily" aria-label="全家福与家人纸条"><span>🏡</span><small>全家福 · 留句话</small></button>');
    $("#assetnote").textContent="二维场景与演示角色 · 美术素材待替换";
    state.demoConfig=loadDemoConfig();
    renderSettings();
    document.body.insertAdjacentHTML("beforeend",'<div class="modal" id="contextModal" role="dialog" aria-modal="true" aria-labelledby="contextTitle"><div class="box"><h3 id="contextTitle"></h3><p class="hint" id="contextHint"></p><textarea id="contextText" maxlength="100" aria-label="愿望或家人纸条"></textarea><div class="row"><button class="btn" id="contextCancel">取消</button><button class="btn pri" id="contextSave">保存</button></div></div></div>');
    $("#explore").innerHTML='<h3 class="world-heading">✦ 探索更多世界</h3><div class="world-list"><button class="world-card" data-go="study"><img class="world-image" src="/assets/latest/literary-study.png" alt=""><span class="world-copy"><b>小王子</b><span>文脉之境 · 从一页书出发，发现照料与陪伴。</span></span><span class="world-tag">可体验</span></button><button class="world-card" data-go="ocean"><img class="world-image" src="/assets/latest/ocean.webp" alt=""><span class="world-copy"><b>海上玻璃球</b><span>心象之境 · 把想象，变成和旅伴共享的风景。</span></span><span class="world-tag">可体验</span></button><div class="world-card world-unavailable"><span class="world-image world-symbol world-dunhuang" aria-hidden="true">✺</span><span class="world-copy"><b>敦煌 · 色彩与飞天</b><span>文化世界 · 从一抹矿物色，认识照料与陪伴。</span></span><span class="world-tag">即将开放</span></div><div class="world-card world-unavailable"><span class="world-image world-symbol world-mountain" aria-hidden="true">山</span><span class="world-copy"><b>山水 · 画中行旅</b><span>文化世界 · 在留白与远山之间，换一种观看。</span></span><span class="world-tag">即将开放</span></div><div class="world-card world-unavailable"><span class="world-image world-symbol world-moon" aria-hidden="true">☽</span><span class="world-copy"><b>诗词 · 月下相逢</b><span>文化世界 · 同一轮月亮，照见不同时代的思念。</span></span><span class="world-tag">即将开放</span></div></div><h3>🐾 和旅伴互动</h3><div class="explore-actions"><button data-action="wag">💗 抚摸 · 开心摇尾</button><button data-action="happy_hop">🐕 和我玩 · 跑跳</button><button data-action="sit">🦴 一起坐下</button><button data-action="head_tilt">✨ 歪头回应</button></div><button class="card" id="reviewJourney"><b>下载本次旅程回顾</b></button>';
    $$("#nav button").forEach(el => el.onclick=() => scene(el.dataset.scene)); $$("[data-hotspot]").forEach(el => el.onclick=() => culture(el.dataset.hotspot));
    $(".scene--literary").addEventListener("click",async event => {
      if(state.scene !== "literary" || desert.busy || event.target.closest("button,.world-entrance")) return;
      const rect=event.currentTarget.getBoundingClientRect();
      if(event.clientY < rect.top+rect.height*.5) return;
      desert.busy=true; const token=++desert.token;
      await walkDesert((event.clientX-rect.left)/rect.width*100,token);
      if(token === desert.token) desert.busy=false;
    });
    $$("[data-go]").forEach(el => el.onclick=() => scene(el.dataset.go)); $$(".tab").forEach(el => el.onclick=() => selectTab(el.dataset.tab));
    $$("[data-action]").forEach(el => el.onclick=() => {if(state.story.busy) cancelInteraction(); if(el.dataset.action === "wish") openContext("wish"); else {action(el.dataset.action); toast("和旅伴互动中");}});
    $("#btnSend").onclick=() => send($("#input").value);
    $("#input").onkeydown=e => {if(e.key === "Enter" && !e.isComposing) {e.preventDefault(); send($("#input").value);}};
    $("#btnMic").onclick=mic;
    $("#btnSound").title="停止朗读"; $("#btnSound").setAttribute("aria-label","停止朗读");
    $("#btnSound").onclick=() => {stopSpeech(); toast("已停止朗读");};
    $("#btnCollapse").onclick=() => {const collapsed=$("#panel").classList.toggle("collapsed"); if(collapsed) cancelInteraction(); $("#btnCollapse").textContent=collapsed ? "‹" : "›"; $("#btnCollapse").title=collapsed ? "展开" : "收起";};
    $("#btnFull").onclick=async () => {try {if(document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();} catch(_) {toast("此浏览器暂不支持全屏。");}};
    $("#hsBook").onclick=() => scene("study"); $("[data-lit=explore]").onclick=startPortal; $("#skipPortal").onclick=finishPortal; $("#hsFamily").onclick=() => openContext("family");
    document.addEventListener("visibilitychange",() => {if(!document.hidden && portalActive && portalBook?.state === "paused") portalBook.resume();});
    $("#contextCancel").onclick=() => $("#contextModal").classList.remove("on");
    $("#contextSave").onclick=() => {const text=$("#contextText").value.trim(); if(!text) {toast("先写下一句话吧。"); return;} $("#contextModal").classList.remove("on"); if(state.contextKind === "wish") {state.wish=text; if(state.scene === "home") runStory(3,text); else scene("ocean");} else {state.familyNote=text; message("dog","这句纸条先放在这里，需要时我们可以再看看。","纸条已保留 · 本次体验");}};
    $("#btnSettings").onclick=() => {cancelInteraction(); renderSettings(); $("#modalSet").classList.add("on"); refreshHealth();};
    $("#btnPet").onclick=() => {cancelInteraction(); $("#openPet").click();};
    $$(".modal").forEach(el => el.onclick=e => {if(e.target === el) el.classList.remove("on");});
    $("#btnPick").onclick=() => $("#petFile").click();
    $("#petFile").onchange=async () => {
      const file=$("#petFile").files?.[0]; if(!file) return; resetPetSelection(); $("#btnGen").disabled=true;
      if(!["image/png","image/jpeg"].includes(file.type) || file.size > 5*1024*1024) {$("#petFile").value=""; toast("请选择5MB以内的PNG或JPG照片。"); return;}
      $("#previewImg").src=await readFile(file); $("#previewBox").classList.add("hasimg"); $("#previewCap").textContent="原始照片 · 尚未生成"; $("#btnGen").disabled=false;
    };
    $("#btnGen").onclick=generatePet; $("#btnConfirm").onclick=() => enterHome(true); $("#btnSkip").onclick=$("#btnLater").onclick=() => enterHome(false);
    $("#reviewJourney").onclick=() => {
      const text=`心之所向 · 本次旅程\n旅伴：${state.petName}\n愿望：${state.wish || "未填写"}\n家人纸条：${state.familyNote || "未填写"}\n\n当前为二维演示；文化卡为待审核内容。`;
      const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"})),link=document.createElement("a"); link.href=url; link.download="心之所向_旅程回顾.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    };
    $("#intro").style.display="none"; updateControls();
    const initialScene=new URLSearchParams(location.search).get("scene");
    const enterSite=() => {$("#welcome").hidden=true; $("#app").inert=false; enterHome(false,initialScene || "home");};
    $("#welcomeEnter").onclick=enterSite;
    if(initialScene) enterSite();
    else $("#app").inert=true;
    request("/api/content").then(content => {state.content=content; renderQuick(); if(state.entered) {$("#contextCaption").textContent=sceneData()?.caption || ""; $("#input").placeholder=sceneData()?.placeholder || "输入你想说的话…";}}).catch(error => toast("场景内容加载失败："+error.message));
    window.addEventListener("pagehide",() => {cancelInteraction(); stopPortal(); closeWorldEntrance();});
  }
  initialize();
})();

