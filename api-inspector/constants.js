// 全局常量定义（background 与 popup、options 页面共用）

// DeepSeek API 请求地址
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// 默认模型
const DEFAULT_MODEL = 'deepseek-v4-flash-vision-exp';

// 每个标签页最多记录的请求条数
const MAX_LOG_SIZE = 300;

// 接口解说的系统提示词
const SYSTEM_PROMPT = `你是资深前端/全栈工程师，擅长通过接口清单逆向理解一个网站的实现。
用户会给你某个网页捕获到的 XHR/Fetch 请求清单（方法、路径、调用次数、状态码、查询参数名）。
请用简体中文输出，结构如下：

**整体判断**：接口风格（REST / GraphQL / RPC 等）、大致的前后端架构观感，2~3 句。

**主要接口解说**：按业务重要性列出核心接口，每个一行：\`路径\` — 推测的业务用途。

**杂音**：指出哪些是埋点、监控、广告、推送类请求，一并列出即可。

基于路径和参数语义合理推断，不确定的地方用"可能"标注，不要编造。保持紧凑。`;
