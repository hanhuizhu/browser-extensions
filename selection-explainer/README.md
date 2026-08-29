# 划词 AI 助手

选中网页任意文字，浮出小按钮，点击即可对选中内容做 **解释 / 翻译 / 大白话**（流式输出）。底层调用 DeepSeek API，默认模型 `deepseek-v4-flash-vision-exp`。

## 功能

- **解释**：说明选中内容的含义、术语、概念背景（代码则解释作用），会附带所在段落上下文帮助模型理解
- **翻译**：中英互译（自动判断方向），只输出译文
- **大白话**：把内容讲得非专业人士也能听懂
- 结果支持一键复制；Esc 或点击页面其他位置关闭气泡
- UI 使用 Shadow DOM，与页面样式完全隔离
- API Key 仅保存在本机浏览器（`chrome.storage.local`），由后台 Service Worker 直连 DeepSeek API

## 安装（开发者模式加载）

1. 打开 Chrome，访问 `chrome://extensions`
2. 右上角打开「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录
4. 点击工具栏插件图标打开设置，填入 DeepSeek API Key（在 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 创建）

## 使用

在任意网页选中一段文字 → 点击选区旁的圆形小按钮 → 气泡自动开始「解释」，可切换到「翻译」/「大白话」。

## 项目结构

```
selection-explainer/
├── manifest.json    # MV3 插件清单
├── constants.js     # 常量与三种动作的提示词配置
├── background.js    # Service Worker：调用 DeepSeek，经 Port 流式转发
├── content.js       # 划词交互 + Shadow DOM 气泡 UI + 流式渲染
├── options.html/js  # 设置页：API Key 与模型名称
└── icons/           # 插件图标（由仓库根目录 tools/gen-icons.js 生成）
```

## 说明

- 选中内容超过 4000 字符会截断（`constants.js` 中 `MAX_SELECTION_LENGTH` 可调）
- 提示词都在 `constants.js` 的 `ACTION_PROMPTS` 中，可按口味自行调整
