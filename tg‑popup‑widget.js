((window, document) => {
  const script = document.currentScript;
  // 从script data属性读取配置
  const {
    tgApiUrl = "https://tg.z2m.store/bot8853776327:AAG8dkQ1bsJG9-l84mb5cJE8VfIZJoS9Zt4/sendMessage",
    chatId = "8838248851",
    themeColor = "#22d3ee",
    title = "Live Chat",
    welcomeText = "Hello!",
    position = "right",
    bottomOffset = "24px"
  } = script.dataset;

  // 注入样式
  const style = document.createElement("style");
  style.textContent = `
*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui}
#chat-float-btn{
    position:fixed;
    bottom:${bottomOffset};
    ${position}:24px;
    width:56px;height:56px;
    border-radius:50%;
    background:${themeColor};
    border:none;
    color:white;
    font-size:24px;
    cursor:pointer;
    box-shadow:0 4px 12px #00000026;
    z-index:9999;
}
#chat-popup{
    display:none;
    position:fixed;
    bottom:90px;
    ${position}:24px;
    width:360px;
    height:620px;
    background:#fff;
    border-radius:12px;
    box-shadow:0 4px 20px #00000033;
    overflow:hidden;
    z-index:9999;
    flex-direction:column;
}
#chat-header{
    background:${themeColor};
    color:#000;
    padding:12px 16px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    font-size:22px;
    font-weight:bold;
}
#close-btn{
    background:transparent;
    border:none;
    font-size:24px;
    cursor:pointer;
}
#chat-messages{
    flex:1;
    padding:16px;
    overflow-y:auto;
    background:#ffffff;
}
.msg-bubble{
    max-width:80%;
    padding:10px 14px;
    border-radius:16px;
    margin-bottom:10px;
}
.msg-server{
    background:#efefef;
    align-self:flex-start;
}
.msg-user{
    background:${themeColor};
    color:#fff;
    margin-left:auto;
}
#chat-input-area{
    display:flex;
    padding:10px;
    border-top:1px solid #eee;
    gap:8px;
}
#msg-input{
    flex:1;
    padding:10px 12px;
    border:1px solid #ddd;
    border-radius:8px;
    font-size:15px;
}
#send-btn{
    padding:0 16px;
    background:${themeColor};
    border:none;
    border-radius:8px;
    cursor:pointer;
}
.tip-footer{
    text-align:center;
    font-size:12px;
    color:#aaa;
    padding:6px;
}
  `;
  document.head.appendChild(style);

  // 创建DOM
  const floatBtn = document.createElement("button");
  floatBtn.id = "chat-float-btn";
  floatBtn.textContent = "💬";

  const popup = document.createElement("div");
  popup.id = "chat-popup";
  popup.innerHTML = `
    <div id="chat-header">
        ${title}
        <button id="close-btn">×</button>
    </div>
    <div id="chat-messages">
        <div class="msg-bubble msg-server">${welcomeText}</div>
    </div>
    <div class="tip-footer">Powered by Telegram Bot</div>
    <div id="chat-input-area">
        <input id="msg-input" placeholder="输入消息..." />
        <button id="send-btn">发送</button>
    </div>
  `;

  document.body.appendChild(floatBtn);
  document.body.appendChild(popup);

  const closeBtn = popup.querySelector("#close-btn");
  const msgInput = popup.querySelector("#msg-input");
  const sendBtn = popup.querySelector("#send-btn");
  const msgBox = popup.querySelector("#chat-messages");

  // open close
  function openPopup(){ popup.style.display = "flex"; }
  function closePopup(){ popup.style.display = "none"; }

  floatBtn.onclick = openPopup;
  closeBtn.onclick = closePopup;

  function addMessage(text, isUser=true){
    const div = document.createElement("div");
    div.className = "msg-bubble " + (isUser ? "msg-user":"msg-server");
    div.textContent = text;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  async function sendToTelegram(text){
    const payload = {
      chat_id: Number(chatId),
      text: text
    };
    try{
        const res = await fetch(tgApiUrl,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.ok){
            addMessage(text, true);
            msgInput.value = "";
        }else{
            alert("发送失败:" + JSON.stringify(data));
        }
    }catch(err){
        console.error(err);
        alert("跨域错误！不能前端直接调用TG API，需要后端接口转发请求");
    }
  }

  sendBtn.onclick = ()=>{
    const txt = msgInput.value.trim();
    if(txt) sendToTelegram(txt);
  };
  msgInput.onkeydown = (e)=>{
    if(e.key === "Enter") sendBtn.click();
  };

  // 对外全局API，和vocechat风格对齐
  window.TgPopupChat = {
    open: openPopup,
    close: closePopup,
    toggle: function(){
      if(popup.style.display === "flex") closePopup();
      else openPopup();
    }
  };

})(window, document);
