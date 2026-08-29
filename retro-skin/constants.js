// 主题定义：key 需稳定（用于记录各标签页当前皮肤），css 为注入的完整样式

const THEMES = {
  terminal: {
    label: '终端绿字',
    emoji: '💻',
    css: `
      html, body, body * {
        background-color: #000 !important;
        background-image: none !important;
        color: #33ff33 !important;
        font-family: "SF Mono", Menlo, "Courier New", monospace !important;
        text-shadow: 0 0 2px rgba(51, 255, 51, 0.55) !important;
        border-color: #1a8a1a !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      a, a * { color: #7fff7f !important; text-decoration: underline !important; }
      img, video, canvas, svg { filter: grayscale(1) brightness(0.9) sepia(1) hue-rotate(60deg) saturate(4) !important; }
      input, textarea, select, button { background: #001a00 !important; border: 1px solid #33ff33 !important; }
      ::selection { background: #33ff33 !important; color: #000 !important; }
      html::after {
        content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
        background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.28) 0 1px, transparent 1px 3px);
      }
    `,
  },
  win98: {
    label: 'Win98',
    emoji: '🪟',
    css: `
      html, body, body * {
        background-image: none !important;
        background-color: #c0c0c0 !important;
        color: #000 !important;
        font-family: Tahoma, "MS Sans Serif", Arial, sans-serif !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      a, a * { color: #00007f !important; text-decoration: underline !important; }
      header, nav, header *, nav * { background-color: #000080 !important; color: #fff !important; }
      button, input[type="submit"], input[type="button"] {
        background: #c0c0c0 !important; color: #000 !important;
        border: 2px outset #ffffff !important; cursor: pointer !important;
      }
      input, textarea, select { background: #fff !important; border: 2px inset #dfdfdf !important; }
      img, video { filter: saturate(0.7) contrast(1.05) !important; }
      ::selection { background: #000080 !important; color: #fff !important; }
    `,
  },
  pixel: {
    label: '像素风',
    emoji: '👾',
    css: `
      img, video, canvas { image-rendering: pixelated !important; filter: contrast(1.15) saturate(1.35) !important; }
      body, body * {
        font-family: "Courier New", monospace !important;
        letter-spacing: 0.5px !important;
        border-radius: 0 !important;
        text-shadow: none !important;
      }
      img, button, input, select, video { box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.35) !important; }
      a { text-decoration: underline !important; }
      html { filter: contrast(1.05) saturate(1.2); }
    `,
  },
};
