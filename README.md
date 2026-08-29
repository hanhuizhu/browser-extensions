# Browser Extensions

自用 Chrome 插件集合，底层统一调用 DeepSeek API（默认模型 `deepseek-v4-flash-vision-exp`），全部零依赖、零构建，开发者模式加载即用。

| 插件 | 功能 |
|------|------|
| [ai-reader-assistant](./ai-reader-assistant/) AI 阅读助手 | 点击图标一键总结当前网页：一句话概括 / 核心要点 / 适合谁读 |
| [selection-explainer](./selection-explainer/) 划词 AI 助手 | 选中网页文字，浮出气泡做解释 / 翻译 / 大白话 |

## 安装

1. 打开 Chrome，访问 `chrome://extensions`，开启「开发者模式」
2. 点击「加载已解压的扩展程序」，选择对应插件的目录
3. 在插件设置页填入 DeepSeek API Key（[开放平台创建](https://platform.deepseek.com/api_keys)）

API Key 只保存在本机浏览器（`chrome.storage.local`），插件直连 DeepSeek API，不经过任何第三方服务。

## 开发

- 无任何依赖，改完代码在 `chrome://extensions` 点刷新即可
- 重新生成图标：`node tools/gen-icons.js`（纯 Node 内置模块手写 PNG 编码）
- 各插件详细说明见各自目录下的 README
