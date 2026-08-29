# AI 阅读助手

一键总结当前网页内容的 Chrome 插件，帮助快速判断「这个页面讲了什么、值不值得细读」。底层调用 DeepSeek API，默认模型 `deepseek-v4-flash-vision-exp`。

## 功能

- 点击插件图标，自动抓取当前页正文（优先 `<article>` / `<main>` 区域，降噪）
- 调用 DeepSeek 流式生成结构化总结：**一句话概括 / 核心要点 / 适合谁读**
- 支持一键复制总结、重新总结
- API Key 仅保存在本机浏览器（`chrome.storage.local`），只用于直连 DeepSeek API

## 安装（开发者模式加载）

1. 打开 Chrome，访问 `chrome://extensions`
2. 右上角打开「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录
4. 点击插件图标 → 「去配置」，填入 DeepSeek API Key（在 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 创建）

## 使用

打开任意网页，点击工具栏上的插件图标即可，弹窗会自动开始总结。

## 项目结构

```
ai-reader-assistant/
├── manifest.json        # MV3 插件清单
├── constants.js         # 共用常量（API 地址、默认模型、提示词等）
├── popup.html/css/js    # 弹窗：抓取正文 + 流式总结渲染
├── options.html/js      # 设置页：API Key 与模型名称
└── icons/               # 插件图标（由仓库根目录 tools/gen-icons.js 生成）
```

## 说明

- 修改模型：设置页可自定义模型名称
- 正文超过 20000 字符会截断（`constants.js` 中 `MAX_CONTENT_LENGTH` 可调）
- 浏览器内置页面（`chrome://` 等）和应用商店页面无法注入脚本，会提示不支持
