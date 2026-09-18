(function () {
  const scriptEl = document.currentScript;
  // 读取data配置
  const config = {
    tgBotUrl: scriptEl.dataset.tgBotUrl || "",
    tgGetUrl: scriptEl.dataset.tgGetUrl || "",
    fileApiBase: scriptEl.dataset.fileApiBase || "",
    getFileUrl: scriptEl.dataset.getFileUrl || "", // 新增：getFile接口地址
    chatId: Number(scriptEl.dataset.chatId) || 0,
    themeColor: scriptEl.dataset.themeColor || "#22d3ee",
    openWidth: parseInt(scriptEl.dataset.openWidth || "360", 10),
    openHeight: parseInt(scriptEl.dataset.openHeight || "700",10),
    welcome: scriptEl.dataset.welcome || "Hello!",
    popupTitle: scriptEl.dataset.popupTitle || "TG聊天",
    pollDelay: parseInt(scriptEl.dataset.pollDelay || "1200",10),
  };

  let offset = 0;
  let isPolling = false;
  let pollingActive = false;
  let isSending = false; // ✅ 发送锁：标记是否正在发送

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

    /* 外层fixed遮罩容器 */
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
    /* 内层弹窗：取消固定right，JS动态控制left、bottom */
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
    /* 文件上传按钮 */
    #tgchat-upload-btn{
      width:36px;height:36px;border-radius:8px;border:none;
      background:#182533;color:#fff;font-size:18px;cursor:pointer;
      flex:0 0 36px;
    }
    #tgchat-file-input{display:none;}
    /* ===== 核心修复 input字体强制16px，阻止iOS自动缩放页面 ===== */
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
    /* 聊天内图片 */
    .tgchat-img-preview{max-width:100%;border-radius:10px;margin-bottom:4px;display:block;}
    /* 聊天内视频 */
    .tgchat-video-preview{max-width:100%;border-radius:10px;margin-bottom:4px;display:block;}
  `;
  document.head.appendChild(style);

  // 构建DOM：增加外层wrap容器 + 文件上传input
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

  // 获取dom引用
  const closeBtn = popup.querySelector("#tgchat-close");
  const msgInput = popup.querySelector("#tgchat-input");
  const sendBtn = popup.querySelector("#tgchat-send");
  const msgBox = popup.querySelector("#tgchat-messages");
  const uploadBtn = popup.querySelector("#tgchat-upload-btn");
  const fileInput = popup.querySelector("#tgchat-file-input");

  // 【核心修复】根据visualViewport计算弹窗位置，解决页面缩放偏移
  function setPopupViewportSize() {
    const viewport = window.visualViewport || {width: window.innerWidth, height: window.innerHeight, scale:1, offsetLeft:0};
    const availWidth = viewport.width;
    const availHeight = viewport.height;
    const scale = viewport.scale || 1;

    // 最大可用宽度
    const maxW = availWidth - 32;
    const finalW = Math.min(config.openWidth, maxW);
    popup.style.width = `${finalW}px`;

    // 计算left：可视视口右边 - 弹窗宽度 - 24px边距
    const leftPos = availWidth - finalW - 24;
    popup.style.left = `${leftPos}px`;
    popup.style.right = "auto"; // 关闭css的right，完全交给left控制

    // 纵向高度逻辑：PC不超过openHeight，手机直接占满屏幕减去底部90px
    let targetHeight;
    // 如果屏幕很高(PC桌面)，使用预设openHeight；手机屏幕小，直接占满可用高度
    if(availHeight > config.openHeight){
      targetHeight = config.openHeight;
    }else{
      targetHeight = availHeight - 90;
    }
    popup.style.maxHeight = `${Math.max(600, targetHeight)}px`;
    popup.style.bottom = "90px";
  }

  // 监听visualViewport尺寸变化
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', setPopupViewportSize);
  }else{
    window.addEventListener('resize', setPopupViewportSize);
  }
  msgInput.addEventListener('focus', setPopupViewportSize);
  msgInput.addEventListener('blur', setPopupViewportSize);

  // 时间格式化
  function formatTime(timestamp) {
    const d = new Date(timestamp * 1000);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
  function getLocalTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  // ========== 修改addMessage，支持 文字 / 图片 / 视频 ==========
  function addMessage(content, isUser=true, timestamp=null, msgType="text"){
    const div = document.createElement("div");
    div.className = "tgchat-bubble " + (isUser ? "tgchat-bubble-user":"tgchat-bubble-server");

    if(msgType === "image"){
      const img = document.createElement("img");
      img.className = "tgchat-img-preview";
      img.src = content;
      img.loading="lazy";
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

  // 切换弹窗
  widgetIcon.addEventListener("click", ()=>{
    popupWrap.classList.toggle("open");
    if(popupWrap.classList.contains("open")){
      setPopupViewportSize();
      pollingActive = true;
      runPollLoop();
    }else{
      pollingActive = false;
    }
  });
  closeBtn.addEventListener("click", ()=>{
    popupWrap.classList.remove("open");
    pollingActive = false;
  });

  //发送文字消息
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

  // ✅ 修改后的发送文件函数，适配 data-file-api-base="https://xxx.workers.dev/sendDocument"
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
      // 图片：把 /sendDocument 替换成 /sendPhoto
      if(file.type.startsWith("image/")){
        uploadUrl = config.fileApiBase.replace("/sendDocument","/sendPhoto");
        formData.append("photo", file);
      }else{
        // 视频/其他文件直接使用配置好的地址
        uploadUrl = config.fileApiBase;
        formData.append("document", file);
      }

      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if(data.ok){
        // 本地预览图片
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

  // 文件选择触发
  uploadBtn.onclick = ()=> fileInput.click();
  fileInput.onchange = async (e)=>{
    const file = e.target.files[0];
    if(file) await sendFileToTG(file);
  };

  // ========== 新增：通过file_id获取TG图片/视频预览地址 ==========
  async function getTgFileUrl(fileId){
    if(!config.getFileUrl) return null;
    const res = await fetch(config.getFileUrl, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({file_id:fileId})
    });
    const json = await res.json();
    if(json.ok){
      const filePath = json.result.file_path;
      // 把 /getFile 替换成 /file 得到预览资源地址
      return `${config.getFileUrl.replace("/getFile","/file")}/${filePath}`;
    }
    return null;
  }

  // ========== 重写轮询，支持接收图片、视频 ==========
  async function runPollLoop(){
    if(!pollingActive || isPolling) return;
    isPolling = true;
    try{
      const res = await fetch(`${config.tgGetUrl}?offset=${offset}&timeout=5`);
      const json = await res.json();
      if(json.ok && Array.isArray(json.result)){
        for(const u of json.result){
          const m = u.message;
          if(!m) continue;
          // 文字消息
          if(m.text){
            addMessage(m.text,false,m.date,"text");
          }
          // 图片消息，取最大尺寸图片
          else if(m.photo && m.photo.length>0){
            const bestPhoto = m.photo[m.photo.length-1];
            const fileUrl = await getTgFileUrl(bestPhoto.file_id);
            if(fileUrl) addMessage(fileUrl,false,m.date,"image");
          }
          // 视频消息
          else if(m.video){
            const fileUrl = await getTgFileUrl(m.video.file_id);
            if(fileUrl) addMessage(fileUrl,false,m.date,"video");
          }
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
    if(e.key === "Enter") {
      e.preventDefault();
      const v = msgInput.value.trim();
      if(v) sendToTelegram(v);
    }
  };

})();
