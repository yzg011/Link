(function () {
  const scriptEl = document.currentScript;
  // 读取data配置
  const config = {
    tgBotUrl: scriptEl.dataset.tgBotUrl || "",
    tgGetUrl: scriptEl.dataset.tgGetUrl || "",
    fileApiBase: scriptEl.dataset.fileApiBase || "",
    getFileUrl: scriptEl.dataset.getFileUrl || "",
    chatId: Number(scriptEl.dataset.chatId) || 0,
    themeColor: scriptEl.dataset.themeColor || "#22d3ee",
    openWidth: parseInt(scriptEl.dataset.openWidth || "360", 10),
    openHeight: parseInt(scriptEl.dataset.openHeight || "700",10),
    welcome: scriptEl.dataset.welcome || "Hello!",
    popupTitle: scriptEl.dataset.popupTitle || "TG聊天",
    pollDelay: parseInt(scriptEl.dataset.pollDelay || "1500",10), // 稍微拉长间隔降低压力
  };

  let offset = 0;
  let isPolling = false;
  let pollingActive = false;
  let isSending = false;
  let abortController = null;

  // 注入CSS
  const style = document.createElement("style");
  style.textContent = `
    #tgchat-widget-icon,
    #tgchat-popup-wrap,
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

    #tgchat-popup-wrap {
      display:none;
      position:fixed;
      inset:0;
      z-index:9998;
      pointer-events:none;
    }
    #tgchat-popup-wrap.open {
      display:block;
    }
    #tgchat-popup{
      position:absolute;
      bottom:90px;
      width:${config.openWidth}px;
      max-width: calc(100vw - 32px);
      background:#0e1621;
      border-radius:12px;
      box-shadow:0 4px 24px rgba(0,0,0,0.4);
      overflow:hidden;
      overflow-x:hidden;
      pointer-events:auto;
      display:flex;
      flex-direction:column;
      min-height:600px;
    }
    #tgchat-header{background:#182533;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;font-size:18px;font-weight:bold;}
    #tgchat-close{background:transparent;border:none;font-size:22px;color:#fff;cursor:pointer;}
    #tgchat-messages{flex:1;padding:16px;overflow-y:auto;overflow-x:hidden;background:#0e1621;min-height:0;}
    .tgchat-bubble{max-width:80%;padding:8px 14px;position:relative;border-radius:16px;margin-bottom:10px;}
    .tgchat-bubble-server{background:#182533;align-self:flex-start;color:#fff;}
    .tgchat-bubble-user{background:${config.themeColor};color:#000;margin-left:auto;}
    .tgchat-text{word-break:break-word;font-size:15px;line-height:1.45;padding-right:48px;}
    .tgchat-time{position:absolute;right:12px;bottom:6px;font-size:11px;color:rgba(255,255,255,0.35);}
    .tgchat-bubble-user .tgchat-time{color:rgba(0,0,0,0.45);}
    #tgchat-input-area{display:flex;padding:10px;border-top:1px solid rgba(255,255,255,0.08);gap:8px;background:#0e1621;align-items:center;}
    #tgchat-upload-btn{
      width:36px;height:36px;border-radius:8px;border:none;
      background:#182533;color:#fff;font-size:18px;cursor:pointer;
      flex:0 0 36px;
    }
    #tgchat-file-input{display:none;}
    #tgchat-input{
      flex:1;
      padding:10px 12px;
      border:1px solid rgba(255,255,255,0.08);
      border-radius:8px;
      font-size:16px !important;
      background:#182533;color:#fff;outline:none;
    }
    #tgchat-input::placeholder{color:rgba(255,255,255,0.45);}
    #tgchat-send{padding:0 16px;background:${config.themeColor};border:none;border-radius:8px;cursor:pointer;color:#000;}
    #tgchat-send:disabled, #tgchat-upload-btn:disabled{opacity:0.5;cursor:not-allowed;}
    .tgchat-footer{text-align:center;font-size:12px;color:rgba(255,255,255,0.35);padding:4px 6px;background:#0e1621;}
    .tgchat-img-preview{max-width:100%;border-radius:10px;margin-bottom:4px;display:block;}
    .tgchat-video-preview{max-width:100%;border-radius:10px;margin-bottom:4px;display:block;}
  `;
  document.head.appendChild(style);

  const widgetIcon = document.createElement("button");
  widgetIcon.id = "tgchat-widget-icon";
  widgetIcon.textContent = "💬";

  const popupWrap = document.createElement("div");
  popupWrap.id = "tgchat-popup-wrap";

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
      <button id="tgchat-upload-btn">📎</button>
      <input type="file" id="tgchat-file-input" />
      <input id="tgchat-input" placeholder="输入消息..." />
      <button id="tgchat-send">发送</button>
    </div>
  `;
  popupWrap.appendChild(popup);

  document.body.appendChild(widgetIcon);
  document.body.appendChild(popupWrap);

  const closeBtn = popup.querySelector("#tgchat-close");
  const msgInput = popup.querySelector("#tgchat-input");
  const sendBtn = popup.querySelector("#tgchat-send");
  const msgBox = popup.querySelector("#tgchat-messages");
  const uploadBtn = popup.querySelector("#tgchat-upload-btn");
  const fileInput = popup.querySelector("#tgchat-file-input");

  function setPopupViewportSize() {
    const viewport = window.visualViewport || {width: window.innerWidth, height: window.innerHeight, scale:1, offsetLeft:0};
    const availWidth = viewport.width;
    const availHeight = viewport.height;

    const maxW = availWidth - 32;
    const finalW = Math.min(config.openWidth, maxW);
    popup.style.width = `${finalW}px`;
    const leftPos = availWidth - finalW - 24;
    popup.style.left = `${leftPos}px`;
    popup.style.right = "auto";

    let targetHeight;
    if(availHeight > config.openHeight){
      targetHeight = config.openHeight;
    }else{
      targetHeight = availHeight - 90;
    }
    popup.style.maxHeight = `${Math.max(600, targetHeight)}px`;
    popup.style.bottom = "90px";
  }

  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', setPopupViewportSize);
  }else{
    window.addEventListener('resize', setPopupViewportSize);
  }
  msgInput.addEventListener('focus', setPopupViewportSize);
  msgInput.addEventListener('blur', setPopupViewportSize);

  function formatTime(timestamp) {
    const d = new Date(timestamp * 1000);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
  function getLocalTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  function addMessage(content, isUser=true, timestamp=null, msgType="text"){
    const div = document.createElement("div");
    div.className = "tgchat-bubble " + (isUser ? "tgchat-bubble-user":"tgchat-bubble-server");

    if(msgType === "image"){
      const img = document.createElement("img");
      img.className = "tgchat-img-preview";
      img.src = content;
      img.loading="lazy";
      img.onerror = function(){
        div.innerHTML = `<div class="tgchat-text">[图片加载失败]</div>`;
      }
      div.appendChild(img);
    }else if(msgType === "video"){
      const video = document.createElement("video");
      video.className = "tgchat-video-preview";
      video.src = content;
      video.controls = true;
      div.appendChild(video);
    }else{
      const t = document.createElement("div");
      t.className = "tgchat-text";
      t.textContent = content;
      div.append(t);
    }
    const ti = document.createElement("div");
    ti.className = "tgchat-time";
    ti.textContent = timestamp ? formatTime(timestamp) : getLocalTime();
    div.append(ti);
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
  }
  addMessage(config.welcome, false, null, "text");

  widgetIcon.addEventListener("click", ()=>{
    popupWrap.classList.toggle("open");
    if(popupWrap.classList.contains("open")){
      setPopupViewportSize();
      pollingActive = true;
      runPollLoop();
    }else{
      pollingActive = false;
      if(abortController) abortController.abort();
    }
  });
  closeBtn.addEventListener("click", ()=>{
    popupWrap.classList.remove("open");
    pollingActive = false;
    if(abortController) abortController.abort();
  });

  async function sendToTelegram(text){
    if(isSending) return;
    isSending = true;
    sendBtn.disabled = true;
    uploadBtn.disabled = true;

    try{
      const res = await fetch(config.tgBotUrl,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({chat_id: config.chatId, text})
      });
      const data = await res.json();
      if(data.ok){
        addMessage(text, true, null, "text");
        msgInput.value = "";
      }else{
        alert("发送失败:"+JSON.stringify(data));
      }
    }catch(e){
      console.error("send error",e);
      alert("请求异常");
    }finally{
      isSending = false;
      sendBtn.disabled = false;
      uploadBtn.disabled = false;
    }
  }

  async function sendFileToTG(file) {
    if(isSending) return;
    isSending = true;
    sendBtn.disabled = true;
    uploadBtn.disabled = true;
    fileInput.value = "";

    try {
      const formData = new FormData();
      formData.append("chat_id", config.chatId);

      let uploadUrl;
      if(file.type.startsWith("image/")){
        uploadUrl = config.fileApiBase.replace("/sendDocument","/sendPhoto");
        formData.append("photo", file);
      }else{
        uploadUrl = config.fileApiBase;
        formData.append("document", file);
      }

      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if(data.ok){
        if(file.type.startsWith("image/")){
          const previewUrl = URL.createObjectURL(file);
          addMessage(previewUrl, true, null, "image");
        }else{
          addMessage(`📄 ${file.name}`, true, null, "text");
        }
      }else{
        alert("文件发送失败:" + JSON.stringify(data));
      }
    } catch(e) {
      console.error("file upload err",e);
      alert("文件上传请求异常");
    }finally{
      isSending = false;
      sendBtn.disabled = false;
      uploadBtn.disabled = false;
    }
  }

  uploadBtn.onclick = ()=> fileInput.click();
  fileInput.onchange = async (e)=>{
    const file = e.target.files[0];
    if(file) await sendFileToTG(file);
  };

  async function getTgFileUrl(fileId){
    if(!config.getFileUrl) return null;
    try{
      const res = await fetch(config.getFileUrl, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({file_id:fileId})
      });
      const json = await res.json();
      console.log("getFile返回：",json);
      if(json.ok){
        const filePath = json.result.file_path;
        const previewUrl = `${config.getFileUrl.replace("/getFile","/file")}/${filePath}`;
        console.log("预览地址：",previewUrl);
        return previewUrl;
      }
    }catch(e){
      console.error("getFile接口失败",e);
    }
    return null;
  }

  async function runPollLoop(){
    if(!pollingActive || isPolling) return;
    // 终止上一轮未完成请求
    if(abortController) abortController.abort();

    isPolling = true;
    abortController = new AbortController();
    const signal = abortController.signal;

    try{
      const res = await fetch(`${config.tgGetUrl}?offset=${offset}&timeout=5`, {signal});
      const json = await res.json();
      console.log("轮询原始数据：",json);
      if(json.ok && Array.isArray(json.result)){
        // 串行逐条处理消息，图片视频await走完getFile，不会中断
        for(const u of json.result){
          const m = u.message;
          if(!m){
            offset = u.update_id +1;
            continue;
          }
          // 过滤自己发的消息
          if(m.from?.id === config.chatId){
            offset = u.update_id +1;
            continue;
          }
          try{
            if(m.text){
              addMessage(m.text,false,m.date,"text");
            }else if(m.photo && m.photo.length>0){
              const bestPhoto = m.photo[m.photo.length-1];
              const fileUrl = await getTgFileUrl(bestPhoto.file_id);
              if(fileUrl){
                addMessage(fileUrl,false,m.date,"image");
              }else{
                addMessage("[图片加载失败]",false,m.date,"text");
              }
            }else if(m.video){
              const fileUrl = await getTgFileUrl(m.video.file_id);
              if(fileUrl){
                addMessage(fileUrl,false,m.date,"video");
              }else{
                addMessage("[视频加载失败]",false,m.date,"text");
              }
            }else if(m.voice){
              addMessage("[语音消息，暂不支持播放]",false,m.date,"text");
            }else{
              addMessage("[未知消息类型]",false,m.date,"text");
            }
          }catch(msgErr){
            console.error("单条消息渲染异常：",msgErr);
            addMessage("[消息解析失败]",false,m.date,"text");
          }
          // 处理完一条，更新offset
          offset = u.update_id + 1;
        }
      }
    }catch(err){
      // 主动abort的错误忽略，不打印
      if(err.name !== "AbortError"){
        console.warn("轮询请求异常：",err);
      }
    }finally{
        abortController = null;
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
    if(e.key === "Enter") {
      e.preventDefault();
      const v = msgInput.value.trim();
      if(v) sendToTelegram(v);
    }
  };

})();
