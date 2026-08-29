// 划词 AI 助手 content script：
// 选中文字后浮出触发按钮，点击展开气泡，可对选中内容做解释 / 翻译 / 大白话（流式渲染）
// UI 全部放在 Shadow DOM 中，与页面样式隔离

(() => {
  if (window.__aiSelectionExplainerLoaded) {
    return;
  }
  window.__aiSelectionExplainerLoaded = true;

  const MIN_SELECTION_LENGTH = 2; // 少于该长度不触发
  const BUBBLE_WIDTH = 340; // 气泡宽度，用于视口边界修正

  // 动作定义需与 background 的 ACTION_PROMPTS 键保持一致
  const ACTIONS = [
    { key: 'explain', label: '解释' },
    { key: 'translate', label: '翻译' },
    { key: 'simplify', label: '大白话' },
  ];

  const state = {
    selectionText: '', // 触发时快照的选中文字
    selectionContext: '', // 选中内容所在段落上下文
    resultRawText: '', // 当前结果的原始文本
    port: null, // 与 background 的长连接
  };

  const { host, trigger, bubble, els } = createUi();

  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideAll();
    }
  });

  function onMouseUp(event) {
    if (event.composedPath().includes(host)) {
      return; // 点击发生在插件自身 UI 上
    }
    // 等选区状态稳定后再判断
    setTimeout(() => {
      if (!bubble.hidden) {
        return; // 气泡展开期间不重复弹出触发按钮
      }
      const selection = window.getSelection();
      const text = (selection?.toString() || '').trim();
      if (text.length < MIN_SELECTION_LENGTH || !selection.rangeCount) {
        hideTrigger();
        return;
      }
      state.selectionText = text;
      state.selectionContext = extractContext(selection);
      showTriggerNear(selection.getRangeAt(0).getBoundingClientRect());
    }, 0);
  }

  function onMouseDown(event) {
    if (!event.composedPath().includes(host)) {
      hideAll();
    }
  }

  // 提取选中内容所在的段落文本作为上下文，帮助模型理解
  function extractContext(selection) {
    let node = selection.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    const block = node?.closest?.('p, li, td, h1, h2, h3, h4, blockquote, pre, article, section');
    return (block?.innerText || '').trim().slice(0, 600);
  }

  function showTriggerNear(rect) {
    const x = Math.min(rect.right + window.scrollX + 4, window.scrollX + window.innerWidth - 40);
    const y = rect.bottom + window.scrollY + 6;
    trigger.style.left = `${x}px`;
    trigger.style.top = `${y}px`;
    trigger.hidden = false;
  }

  function hideTrigger() {
    trigger.hidden = true;
  }

  function hideAll() {
    hideTrigger();
    bubble.hidden = true;
    disconnectPort();
  }

  function openBubble() {
    const left = Math.max(
      window.scrollX + 8,
      Math.min(parseFloat(trigger.style.left), window.scrollX + window.innerWidth - BUBBLE_WIDTH - 16)
    );
    bubble.style.left = `${left}px`;
    bubble.style.top = trigger.style.top;
    hideTrigger();
    bubble.hidden = false;
    runAction(ACTIONS[0].key); // 默认执行「解释」
  }

  // 执行一个动作：建立长连接，流式接收结果
  function runAction(actionKey) {
    disconnectPort();
    state.resultRawText = '';
    els.result.innerHTML = '';
    els.setupBox.hidden = true;
    els.error.hidden = true;
    els.copyBtn.hidden = true;
    els.loading.hidden = false;
    setActiveTab(actionKey);

    const port = chrome.runtime.connect({ name: 'ai-request' });
    state.port = port;

    port.onMessage.addListener((message) => {
      if (port !== state.port) {
        return; // 已被新请求取代
      }
      handlePortMessage(message);
    });

    port.postMessage({
      type: 'request',
      action: actionKey,
      text: state.selectionText,
      context: state.selectionContext,
      title: document.title,
    });
  }

  function handlePortMessage(message) {
    switch (message.type) {
      case 'delta':
        els.loading.hidden = true;
        state.resultRawText += message.content;
        els.result.innerHTML = renderMarkdown(state.resultRawText);
        break;
      case 'done':
        els.loading.hidden = true;
        els.copyBtn.hidden = !state.resultRawText;
        break;
      case 'needKey':
        els.loading.hidden = true;
        els.setupBox.hidden = false;
        break;
      case 'error':
        els.loading.hidden = true;
        els.error.textContent = message.message;
        els.error.hidden = false;
        break;
      default:
        break;
    }
  }

  function disconnectPort() {
    if (state.port) {
      try {
        state.port.disconnect();
      } catch {
        // 忽略
      }
      state.port = null;
    }
  }

  function setActiveTab(actionKey) {
    for (const tab of els.tabs) {
      tab.classList.toggle('is-active', tab.dataset.action === actionKey);
    }
  }

  async function copyResult() {
    if (!state.resultRawText) {
      return;
    }
    await navigator.clipboard.writeText(state.resultRawText);
    els.copyBtn.textContent = '已复制 ✓';
    setTimeout(() => {
      els.copyBtn.textContent = '复制';
    }, 1500);
  }

  // ===== UI 构建 =====

  function createUi() {
    const hostEl = document.createElement('div');
    hostEl.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; z-index: 2147483647;';
    const shadow = hostEl.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>${uiStyles()}</style>
      <button class="trigger" part="trigger" hidden title="划词 AI 助手"><span class="trigger__dot"></span></button>
      <div class="bubble" hidden>
        <div class="bubble__header">
          <div class="bubble__tabs">
            ${ACTIONS.map((a) => `<button class="tab" data-action="${a.key}">${a.label}</button>`).join('')}
          </div>
          <button class="bubble__close" title="关闭">×</button>
        </div>
        <div class="bubble__body">
          <div class="loading" hidden><span class="spinner"></span>思考中…</div>
          <div class="setup" hidden>
            <p>首次使用需要配置 DeepSeek API Key</p>
            <button class="setup__btn">去配置</button>
          </div>
          <div class="error" hidden></div>
          <div class="result"></div>
        </div>
        <div class="bubble__footer"><button class="copy" hidden>复制</button></div>
      </div>
    `;

    const triggerEl = shadow.querySelector('.trigger');
    const bubbleEl = shadow.querySelector('.bubble');
    const uiEls = {
      tabs: [...shadow.querySelectorAll('.tab')],
      loading: shadow.querySelector('.loading'),
      setupBox: shadow.querySelector('.setup'),
      error: shadow.querySelector('.error'),
      result: shadow.querySelector('.result'),
      copyBtn: shadow.querySelector('.copy'),
    };

    // mousedown 阻止默认行为，避免点击按钮时页面选区被清空
    triggerEl.addEventListener('mousedown', (event) => event.preventDefault());
    triggerEl.addEventListener('click', openBubble);
    shadow.querySelector('.bubble__close').addEventListener('click', hideAll);
    shadow.querySelector('.setup__btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'openOptions' });
    });
    uiEls.copyBtn.addEventListener('click', copyResult);
    for (const tab of uiEls.tabs) {
      tab.addEventListener('click', () => runAction(tab.dataset.action));
    }

    document.documentElement.appendChild(hostEl);
    return { host: hostEl, trigger: triggerEl, bubble: bubbleEl, els: uiEls };
  }

  function uiStyles() {
    return `
      :host { all: initial; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      .trigger {
        position: absolute; width: 26px; height: 26px; border: none; border-radius: 50%;
        background: linear-gradient(135deg, #a855f7, #ec4899); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      }
      .trigger:hover { transform: scale(1.1); }
      .trigger__dot { width: 10px; height: 10px; border: 2px solid #fff; border-radius: 50%; }
      .bubble {
        position: absolute; width: ${BUBBLE_WIDTH}px; background: #fff; border-radius: 12px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18); overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
        font-size: 13px; color: #1f2733;
      }
      .bubble__header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 10px; background: linear-gradient(135deg, #a855f7, #ec4899);
      }
      .bubble__tabs { display: flex; gap: 6px; }
      .tab {
        border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;
        background: rgba(255, 255, 255, 0.2); color: #fff;
      }
      .tab.is-active { background: #fff; color: #a13bd6; font-weight: 600; }
      .bubble__close {
        border: none; background: transparent; color: #fff; font-size: 16px;
        width: 22px; height: 22px; cursor: pointer; border-radius: 6px;
      }
      .bubble__close:hover { background: rgba(255, 255, 255, 0.25); }
      .bubble__body { padding: 10px 12px; max-height: 300px; overflow-y: auto; line-height: 1.7; }
      .loading { display: flex; align-items: center; gap: 8px; color: #5a6472; }
      .spinner {
        width: 13px; height: 13px; border: 2px solid #e3d5f5; border-top-color: #a855f7;
        border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .setup { text-align: center; padding: 8px 0; color: #5a6472; }
      .setup__btn {
        margin-top: 10px; padding: 5px 16px; border: none; border-radius: 8px;
        background: #a855f7; color: #fff; font-size: 12px; cursor: pointer;
      }
      .error {
        padding: 8px 10px; background: #fdf0f0; border: 1px solid #f5c6c6; border-radius: 8px;
        color: #b03a3a; word-break: break-all;
      }
      .result p { margin: 4px 0; }
      .result ul { margin: 4px 0; padding-left: 18px; }
      .result li { margin: 3px 0; }
      .result h3 { margin: 8px 0 4px; font-size: 13px; color: #a13bd6; }
      .result strong { color: #a13bd6; }
      .result code { padding: 1px 4px; background: #f4eefb; border-radius: 4px; font-size: 12px; }
      .bubble__footer { display: flex; justify-content: flex-end; padding: 0 12px 10px; }
      .bubble__footer:not(:has(.copy:not([hidden]))) { display: none; }
      .copy {
        padding: 4px 12px; border: 1px solid #d6dbe3; border-radius: 8px; background: #fff;
        font-size: 12px; cursor: pointer; color: #1f2733;
      }
      .copy:hover { border-color: #a855f7; color: #a855f7; }
    `;
  }

  // ===== 极简 Markdown 渲染（加粗 / 标题 / 列表 / 行内代码）=====

  function renderMarkdown(text) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = escaped.split('\n');
    const html = [];
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const isListItem = /^[-*]\s+/.test(trimmed) || /^\d+[.、]\s+/.test(trimmed);

      if (isListItem && !inList) {
        html.push('<ul>');
        inList = true;
      }
      if (!isListItem && inList) {
        html.push('</ul>');
        inList = false;
      }

      if (isListItem) {
        html.push(`<li>${renderInline(trimmed.replace(/^([-*]|\d+[.、])\s+/, ''))}</li>`);
      } else if (/^#{1,4}\s+/.test(trimmed)) {
        html.push(`<h3>${renderInline(trimmed.replace(/^#{1,4}\s+/, ''))}</h3>`);
      } else if (trimmed) {
        html.push(`<p>${renderInline(trimmed)}</p>`);
      }
    }
    if (inList) {
      html.push('</ul>');
    }
    return html.join('');
  }

  function renderInline(text) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
})();
