(function () {
  const scriptEl = document.currentScript;
  // 读取data配置
  const config = {
    tgBotUrl: scriptEl.dataset.tgBotUrl || "",
    tgGetUrl: scriptEl.dataset.tgGetUrl || "",
    chatId: Number(scriptEl.dataset.chatId) || 0,
    themeColor: scriptEl.dataset.themeColor || "#22d3ee",
    openWidth: parseInt(scriptEl.dataset.openWidth || "360", 10),
    openHeight: parseInt(scriptEl.dataset.openHeight || "600", 10),
    welcome: scriptEl.dataset.welcome || "Hello!",
    popupTitle: scriptEl.dataset.popupTitle || "TG聊天",
    pollDelay: parseInt(scriptEl.dataset.pollDelay || "1200",10),
  };

  let offset = 0;
  let isPolling = false;
  let pollingActive = false;

  // 注入CSS：移除全局*，仅作用挂件内部元素，修复移动端软键盘挤压
  const style = document.createElement("style");
  style.textContent = `
    #tgchat-widget-icon,
    #tgchat-popup,
    #tgchat-popup *,
    .tgchat-bubble,
    .tgchat-text,
    .tgchat-time,
    #tgchat-header,
    #tgchat-close,
    #tgchat-messages,
    #tgchat-input-area,
    #tgchat-input,
    #tgchat-send,
    .tgchat-footer {
      box-sizing:border-box;
      font-family:system-ui;
    }
    #tgchat-widget-icon{
      position:fixed;
      bottom:24px;
      right:24px;
      width:56px;height:56px;
      border-radius:50%;
      background:${config.themeColor};
      border:none;color:#000;font-size:24px;
      cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.25);
      z-index:9999;display:flex;align-items:center;justify-content:center;
      transition:transform 0.2s ease;
    }
    #tgchat-widget-icon:hover{transform:scale(1.08);}
    #tgchat-popup{
      display:none;
      position:fixed;
      bottom:90px;
      right:24px;
      width:${config.openWidth}px;
      /* 重点：不用固定height，改用max-height，高度自适应 */
      max-height:${config.openHeight}px;
      background:#0e1621;
      border-radius:12px;
      box-shadow:0 4px 24px rgba(0,0,0,0.4);
      overflow:hidden;
      z-index:9998;
      flex-direction:column;
    }
    #tgchat-popup.open{display:flex;}
    /* 移动端适配：屏幕小于480px，弹窗贴满右侧，限制最大高度为视口高度 */
    @media (max-width: 480px) {
      #tgchat-popup{
        width: calc(100% - 16px);
        right:8px;
        bottom:80px;
        max-height: calc(100vh - 100px);
      }
      #tgchat-widget-icon{
        bottom:16px;
        right:16px;
      }
    }
    #tgchat-header{background:#182533;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;font-size:18px;font-weight:bold;}
    #tgchat-close{background:transparent;border:none;font-size:22px;color:#fff;cursor:pointer;}
    #tgchat-messages{flex:1;padding:16px;overflow-y:auto;background:#0e1621;min-height:0;}
    .tgchat-bubble{max-width:80%;padding:8px 14px;position:relative;border-radius:16px;margin-bottom:10px;}
    .tgchat-bubble-server{background:#182533;align-self:flex-start;color:#fff;}
    .tgchat-bubble-user{background:${config.themeColor};color:#000;margin-left:auto;}
    .tgchat-text{word-break:break-word;font-size:15px;line-height:1.45;padding-right:48px;}
    .tgchat-time{position:absolute;right:12px;bottom:6px;font-size:11px;color:rgba(255,255,255,0.35);}
    .tgchat-bubble-user .tgchat-time{color:rgba(0,0,0,0.45);}
    #tgchat-input-area{display:flex;padding:10px;border-top:1px solid rgba(255,255,255,0.08);gap:8px;background:#0e1621;}
    #tgchat-input{flex:1;padding:10px 12px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;font-size:15px;background:#182533;color:#fff;outline:none;}
    #tgchat-input::placeholder{color:rgba(255,255,255,0.45);}
    #tgchat-send{padding:0 16px;background:${config.themeColor};border:none;border-radius:8px;cursor:pointer;color:#000;}
    .tgchat-footer{text-align:center;font-size:12px;color:rgba(255,255,255,0.35);padding:4px 6px;background:#0e1621;}
  `;
  document.head.appendChild(style);

  // 构建DOM
  const widgetIcon = document.createElement("button");
  widgetIcon.id = "tgchat-widget-icon";
  widgetIcon.textContent = "💬";

  const popup = document.createElement("div");
  popup.id = "tgchat-popup";
  popup.innerHTML = `
    <div id="tgchat-header">
      ${config.popupTitle}
      <button id="tgchat-close">×</button>
    </div>
    <div id="tgchat-messages"></div>
    <div class="tgchat-footer">Powered by Telegram Bot</div>
    <div id="tgchat-input-area">
      <input id="tgchat-input" placeholder="输入消息..." />
      <button id="tgchat-send">发送</button>
    </div>
  `;

  document.body.appendChild(widgetIcon);
  document.body.appendChild(popup);

  // 获取dom引用
  const closeBtn = popup.querySelector("#tgchat-close");
  const msgInput = popup.querySelector("#tgchat-input");
  const sendBtn = popup.querySelector("#tgchat-send");
  const msgBox = popup.querySelector("#tgchat-messages");

  // 监听视口变化（软键盘弹出/收起）动态限制弹窗高度
  function setPopupViewportHeight() {
    const availHeight = window.innerHeight;
    popup.style.maxHeight = `${availHeight - 100}px`;
  }
  window.addEventListener('resize', setPopupViewportHeight);

  // 时间格式化
  function formatTime(timestamp) {
    const d = new Date(timestamp * 1000);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
  function getLocalTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  // 添加消息
  function addMessage(text, isUser=true, timestamp=null){
    const div = document.createElement("div");
    div.className = "tgchat-bubble " + (isUser ? "tgchat-bubble-user":"tgchat-bubble-server");
    const t = document.createElement("div");
    t.className = "tgchat-text";
    t.textContent = text;
    const ti = document.createElement("div");
    ti.className = "tgchat-time";
    ti.textContent = timestamp ? formatTime(timestamp) : getLocalTime();
    div.append(t,ti);
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
  }
  addMessage(config.welcome, false);

  // 切换弹窗
  widgetIcon.addEventListener("click", ()=>{
    popup.classList.toggle("open");
    if(popup.classList.contains("open")){
      setPopupViewportHeight();
      pollingActive = true;
      runPollLoop();
    }else{
      pollingActive = false;
    }
  });
  closeBtn.addEventListener("click", ()=>{
    popup.classList.remove("open");
    pollingActive = false;
  });

  //发送消息
  async function sendToTelegram(text){
    try{
      const res = await fetch(config.tgBotUrl,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({chat_id: config.chatId, text})
      });
      const data = await res.json();
      if(data.ok){
        addMessage(text, true);
        msgInput.value = "";
      }else{
        alert("发送失败:"+JSON.stringify(data));
      }
    }catch(e){
      console.error("send error",e);
      alert("请求异常");
    }
  }

  //轮询
  async function runPollLoop(){
    if(!pollingActive || isPolling) return;
    isPolling = true;
    try{
      const res = await fetch(`${config.tgGetUrl}?offset=${offset}&timeout=5`);
      const json = await res.json();
      if(json.ok && Array.isArray(json.result)){
        for(const u of json.result){
          const m = u.message;
          if(!m||!m.text) continue;
          addMessage(m.text,false,m.date);
          offset = u.update_id + 1;
        }
      }
    }catch(err){
      console.warn("poll error",err);
    }finally{
      isPolling = false;
      if(pollingActive){
        setTimeout(runPollLoop, config.pollDelay);
      }
    }
  }

  sendBtn.onclick = ()=>{
    const v = msgInput.value.trim();
    if(v) sendToTelegram(v);
  };
  msgInput.onkeydown = (e)=>{
    if(e.key === "Enter") sendBtn.click();
  };

})();
