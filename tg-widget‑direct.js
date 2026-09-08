// IIFE模仿VoceChat Widget，无后端中转，浏览器直接调用tg代理（仅本地调试可用，线上存在CORS）
((w, d) => {
  const {
    botToken = "",
    chatId = "",
    tgApiBase = "https://tg.z2m.store/bot",
    closeWidth = 48,
    closeHeight = 48,
    openWidth = 380,
    openHeight = 660,
    themeColor = "#22d3ee",
    title = "Live Chat",
    position = "right",
    welcomeText = "Hello!",
    useShadowDom = "true"
  } = d.currentScript.dataset;

  const sendMessageUrl = `${tgApiBase}${botToken}/sendMessage`;

  const baseStyle = {
    position: "fixed",
    [position]: "16px",
    bottom: "16px",
    border: "none",
    zIndex: "99999",
    margin: "0",
    padding: "0"
  };

  if (useShadowDom === "true") {
    const container = d.createElement("div");
    container.id = "TG_CHAT_WIDGET_CONTAINER";
    Object.assign(container.style, baseStyle);
    container.style.pointerEvents = "none";
    d.body.appendChild(container);

    const shadow = container.attachShadow({ mode: "open" });

    const root = d.createElement("div");
    root.id = "tg-widget-root";
    root.style.pointerEvents = "auto";
    root.style.width = `${closeWidth}px`;
    root.style.height = `${closeHeight}px`;
    root.style.transition = "width 0.25s ease, height 0.25s ease";
    root.style.borderRadius = "12px";
    root.style.overflow = "hidden";
    shadow.appendChild(root);

    const style = d.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; margin:0; padding:0; font-family: system-ui, sans-serif; }
      .float-btn {
        width: ${closeWidth}px;
        height: ${closeHeight}px;
        border-radius: 50%;
        border: none;
        background: ${themeColor};
        color: #fff;
        font-size: 22px;
        cursor: pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      }
      .popup-wrap {
        width:100%;
        height:100%;
        display:flex;
        flex-direction:column;
        background:#fff;
      }
      .popup-header {
        background:${themeColor};
        color:#000;
        padding:10px 14px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        font-weight:bold;
        font-size:18px;
      }
      .popup-close {
        background:transparent;
        border:none;
        font-size:22px;
        cursor:pointer;
      }
      .msg-area {
        flex:1;
        padding:12px;
        overflow-y:auto;
        background:#ffffff;
      }
      .msg-bubble {
        max-width:82%;
        padding:8px 12px;
        border-radius:14px;
        margin-bottom:8px;
        word-break:break-word;
      }
      .msg-bubble.server {
        background:#eeeeee;
      }
      .msg-bubble.user {
        background:${themeColor};
        color:#fff;
        margin-left:auto;
      }
      .input-bar {
        display:flex;
        gap:6px;
        padding:8px;
        border-top:1px solid #eee;
      }
      .input-bar input {
        flex:1;
        padding:8px 10px;
        border:1px solid #ddd;
        border-radius:8px;
        font-size:14px;
      }
      .input-bar button {
        padding:0 12px;
        background:${themeColor};
        color:#fff;
        border:none;
        border-radius:8px;
        cursor:pointer;
      }
    `;
    shadow.appendChild(style);

    let isOpen = false;

    root.innerHTML = `
      <button class="float-btn">💬</button>
      <div class="popup-wrap" style="display:none;">
        <div class="popup-header">
          <span>${title}</span>
          <button class="popup-close">×</button>
        </div>
        <div class="msg-area">
          <div class="msg-bubble server">${welcomeText}</div>
        </div>
        <div class="input-bar">
          <input placeholder="输入消息...">
          <button>发送</button>
        </div>
      </div>
    `;

    const floatBtn = root.querySelector(".float-btn");
    const popupWrap = root.querySelector(".popup-wrap");
    const closeBtn = root.querySelector(".popup-close");
    const msgArea = root.querySelector(".msg-area");
    const inputEl = root.querySelector(".input-bar input");
    const sendBtn = root.querySelector(".input-bar button");

    const setOpen = (open) => {
      isOpen = open;
      if (open) {
        root.style.width = `${openWidth}px`;
        root.style.height = `${openHeight}px`;
        floatBtn.style.display = "none";
        popupWrap.style.display = "flex";
      } else {
        root.style.width = `${closeWidth}px`;
        root.style.height = `${closeHeight}px`;
        floatBtn.style.display = "flex";
        popupWrap.style.display = "none";
      }
    };

    const appendMsg = (text, isUser) => {
      const div = d.createElement("div");
      div.className = "msg-bubble " + (isUser ? "user" : "server");
      div.textContent = text;
      msgArea.appendChild(div);
      msgArea.scrollTop = msgArea.scrollHeight;
    };

    // 直接前端调用TG代理，无中转
    const sendMessage = async (text) => {
      const content = text.trim();
      if (!content) return;
      appendMsg(content, true);
      inputEl.value = "";
      try {
        const res = await fetch(sendMessageUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: content })
        });
        const ret = await res.json();
        if (!ret.ok) {
          appendMsg(`⚠️发送失败: ${ret.description}`, false);
        }
      } catch (e) {
        appendMsg("⚠️CORS跨域错误，线上环境必须使用中转", false);
        console.error("TG fetch error:", e);
      }
    };

    floatBtn.onclick = () => setOpen(true);
    closeBtn.onclick = () => setOpen(false);
    sendBtn.onclick = () => sendMessage(inputEl.value);
    inputEl.onkeydown = (ev) => {
      if (ev.key === "Enter") sendMessage(inputEl.value);
    };

    // 全局API，和VoceChatWidget用法完全一致
    w.TgChatWidget = {
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!isOpen)
    };

  } else {
    // iframe模式，无中转，需要配套iframe页面，这里省略
    console.warn("useShadowDom=false iframe模式需要配套页面，当前只实现shadow‑dom模式");
  }
})(window, document);
