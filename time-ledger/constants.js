// 全局常量定义（background 与 popup、options 页面共用）

// DeepSeek API 请求地址
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// 默认模型
const DEFAULT_MODEL = 'deepseek-v4-flash-vision-exp';

// 采样间隔（分钟）：每次采样给当前活跃站点记这么多时长
const SAMPLE_INTERVAL_MINUTES = 1;

// 数据保留天数
const DAYS_KEPT = 30;

// 判定空闲的秒数：超过该时长无键鼠操作则不计时
const IDLE_THRESHOLD_SECONDS = 60;

// 周报点评的系统提示词
const SYSTEM_PROMPT = `你是一位犀利但善意的"注意力教练"。用户会给你最近 7 天各网站的浏览时长统计。
请用简体中文输出一份简短点评，结构如下：

**整体判断**：这周的注意力分配画像，1~2 句，可以适度挖苦但要准。

**最大的时间黑洞**：指出最吞时间的站点，估算占比，一句话点评。

**值得表扬的**：如果有学习/工作/文档类的投入就表扬，没有就直说。

**一条建议**：只给一条最值得执行的具体建议。

数据是采样统计（1 分钟粒度），不必纠结精确值。保持简短，不超过 200 字。`;
