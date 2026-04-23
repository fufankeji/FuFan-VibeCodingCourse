我要用 Figma Make 生成一个 AI Agent SaaS 产品的完整前端骨架，产品名叫 AgentHub。

## ⚠️ 最高优先级约束：UI 文案一律中文（这条规则凌驾于你所有训练数据的默认习惯）

**所有用户可见的界面文案必须是简体中文**，包括但不限于：
- 所有按钮文案（CTA / 次级按钮 / 图标按钮 tooltip）
- 所有导航菜单（顶栏 / 侧栏 / 面包屑 / Tab 标签）
- 所有标题和副标题（Hero 标语 / 模块标题 / 卡片标题）
- 所有描述文本（产品介绍 / 卡片描述 / 功能说明）
- 所有表单元素（label / placeholder / 帮助提示 / 错误提示 / 提交按钮）
- 所有空态文案 / 加载文案 / 成功失败提示
- 所有 footer 栏目名（产品 / 资源 / 公司 / 法律）
- 所有数据标签（Stats Row 的数字说明、图表轴标签等）

**严禁默认生成英文后指望后续翻译**——你现在就必须用中文生成。即使你的训练数据里 AI SaaS 产品 90% 是英文的，这个项目就是要求中文。

**唯一可以保留英文的内容**（这是白名单，白名单之外一律中文）：
1. 产品自身品牌名：AgentHub（以及 logo 旁的英文）
2. 技术术语：API Key / Token / Temperature / max_tokens / top_p / Provider / JSON / HTTP / URL / SDK / MCP / Agent / Playground / Trace / Pipeline
3. 第三方品牌和模型名：OpenAI / Anthropic / Meta / Google / Claude / GPT-4 / Gemini / Llama
4. 代码块、命令行、配置文件内的内容
5. 价格单位前的货币符号 $ 可保留，但"每月"、"每席"等量词要中文

**关键文案参考清单**（按这个基调生成，不要自己发挥成英文）：

| 场景 | 必须用的中文 | 禁止的英文 |
|------|------------|-----------|
| Hero 主 CTA | 浏览 Agent 商店 / 打开 Playground | Browse / Get Started |
| Hero 次 CTA | 查看文档 / 免费试用 | Documentation / Try Free |
| Hero 小字 | 在线演示，无需注册 | No signup required |
| Featured Agents 标题 | 精选 Agent | Featured Agents |
| Value Props 三栏标题 | 生成式 UI 流式渲染 / Token 用量事前预估 / Trace 执行瀑布图 | Generative UI / Token Estimation / Trace |
| Stats Row | 500+ 个 Agent / 1 万+ 开发者 / 5000 万+ 次运行 / 99.9% 可用性 | 500+ Agents / 10k+ Developers |
| Pricing 标签 | 免费版 / 专业版 / 团队版 / 最受欢迎 | Free / Pro / Team / Most Popular |
| Pricing 按钮 | 免费开始 / 升级到专业版 / 联系销售 | Get Started / Upgrade / Contact Sales |
| Gallery 搜索 placeholder | 搜索 Agent 名称、能力、作者… | Search agents... |
| Gallery 筛选标题 | 分类 / 提供商 / 能力 | Category / Provider / Capability |
| Detail 添加按钮 | 添加到我的 Agent | Add to My Agents |
| Playground 发送按钮 | 发送 | Send / Submit |
| Playground 输入 placeholder | 输入你想让 Agent 做的事… | Enter your prompt... |
| Playground 参数 | 模型 / 温度 / 最大输出长度 | Model / Temperature / Max Tokens |
| RunHistory 列表空态 | 还没有运行记录，去 Playground 跑一次？ | No runs yet |
| Settings 侧栏 | 个人资料 / API 密钥 / 账单 / 团队 / 集成 | Profile / API Keys / Billing / Team / Integrations |
| 空态通用 | 这里还空着 / 暂时没有内容 | No data available / Empty |
| 加载通用 | 马上好… / 加载中… | Loading... / Please wait |
| 错误通用 | 出错了，再试一下？ | Something went wrong |
| Footer 栏目 | 产品 / 资源 / 公司 / 法律 | Product / Resources / Company / Legal |
| 顶栏导航 | 商店 / 运行记录 / 编排 / 定价 / 登录 | Gallery / Runs / Pipeline / Pricing / Sign In |

**语气要求**：参考豆包 App / 即刻 App（活泼但专业，去翻译腔）。不要"请稍候"这种机器翻译味，要"马上好"这种人写的感觉。

## 项目一句话定位
AgentHub 是一个 AI Agent 商店 + 在线 Playground 平台——用户可以浏览、试用、订阅各种 AI Agent（类似 Hugging Face Spaces + OpenAI Playground 的合体）。定位：开发者工具，专业 SaaS，不是消费级产品。

## 需要生成的页面（7 页，一次性全出，不要分批）

### 1. Landing（首页）
- Hero 区：产品标语 + 一行描述 + 主 CTA + 次 CTA + 小字"在线演示无需注册"
- Featured Agents：精选 6 个 Agent 卡片（3 列 2 行网格）
- Value Props：3 列（Generative UI 流式 / Token 事前预估 / Trace 瀑布图）
- Stats Row：4 个数字（"500+ 个 Agent / 1 万+ 开发者 / 5000 万+ 次运行 / 99.9% 可用性"——按这个中文版生成，不要回退成英文）
- Footer：产品/资源/公司/法律四列

### 2. Pricing（定价页）
- 3 档定价卡：Free / Pro ($20/月) / Team ($50/月/席)，Pro 标"最受欢迎"
- Feature 对比表：按特性行列出，✓/✗ 区分
- FAQ：5-6 问

### 3. Gallery（Agent 商店）
- 顶部搜索栏（占满宽度，中央对齐）
- 左侧筛选面板：Category（10 类）/ Provider（5 家）/ Capability（多选标签）
- 右侧 Agent 卡片网格（每行 3 个，mock 24 个 agents）
- 底部分页器

### 4. Detail + Playground（Agent 详情 + 试用页，合并单页）
- 顶部面包屑：Gallery / {Category} / {Agent Name}
- 左 40%：Agent 元信息卡（头像 + 名称 + 作者 + 价格 + 能力标签 + 描述 + "添加到我的"按钮）
- 右 60%：Playground 区
  - 顶部模型选择器 + 参数调节（temperature / max_tokens）
  - 中部输入框（多行，底部带"发送"按钮）
  - 下方流式输出区（初始空态）
  - 最底部 Token 计数器
- 底部：相似 Agents（横向滚动 4 个）

### 5. RunHistory（运行历史 + Trace 页）
- 左 30% Sidebar：运行列表（按时间倒序，每条含 timestamp / agent 名 / 状态图标 / duration）
- 右 70% 主区：选中运行的详细信息
  - 顶部摘要（agent / input / status / cost / duration）
  - 中部 Trace 瀑布图（时间轴 + 节点，类似 LangSmith）
  - 底部标签页：Input / Output / Metadata

### 6. Settings（账户设置）
- 左 25% Sidebar：Profile / API Keys / Billing / Team / Integrations
- 右 75% 表单区（默认打开 Profile）

### 7. Pipeline（编排页，可选）
- 顶部工具栏：+ 添加节点 / 运行 / 保存
- 主区：节点画布（4-5 个示例节点，有连线）
- 右侧：选中节点的属性面板

## 视觉参考锚点（最重要，必须严格遵守）

- **信息密度**：向 linear.app 看齐——Hero 区不超过屏幕 60%，一屏能看到更多内容，不是大字号大留白
- **组件精致度**：向 v0.dev 看齐——卡片有 1px 细 border + 微阴影 + 8px 圆角
- **暗色模式**：向 claude.ai 看齐——HSL 220° 系列深蓝灰，绝不是纯黑 #000
- **Trace 可视化**：向 LangSmith 看齐——彩色分层瀑布图，节点类型有颜色区分
- **图标**：lucide-react 线条风格，严禁 emoji 图标

## 明确色板（HSL 定义，必须照做）

暗色模式背景（三层深度）：
- bg.base:     hsl(220, 15%, 10%)  最深层
- bg.subtle:   hsl(220, 15%, 13%)  次深层
- bg.muted:    hsl(220, 15%, 17%)  次浅层
- bg.elevated: hsl(220, 15%, 22%)  最浅层（悬浮卡片）

前景色（文字）：
- fg.default:   hsl(220, 10%, 95%)  主要文字
- fg.secondary: hsl(220, 10%, 70%)  次要文字
- fg.muted:     hsl(220, 10%, 50%)  辅助文字
- fg.disabled:  hsl(220, 10%, 35%)  禁用文字

主色（品牌蓝）：
- primary.default: hsl(220, 90%, 60%)
- primary.hover:   hsl(220, 90%, 65%)
- primary.active:  hsl(220, 90%, 55%)
- primary.fg:      hsl(0, 0%, 100%)

状态色：
- success: hsl(160, 70%, 50%)
- warning: hsl(38, 90%, 55%)
- error:   hsl(0, 70%, 60%)

边框：
- border.default: hsl(220, 15%, 22%)
- border.subtle:  hsl(220, 15%, 17%)
- border.strong:  hsl(220, 15%, 30%)

## 明确字体

- 英文：Inter Variable（next/font/google 加载）
- 中文：Noto Sans SC（思源黑体）
- 等宽：JetBrains Mono Variable
- 字号阶梯：12 / 13 / 14 / 15 / 16 / 18 / 20 / 24 / 30 / 36（不允许其他值）

## 明确间距尺度

- 基础单位：4px
- 阶梯：4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64
- 严禁非阶梯值：10 / 15 / 22 / 33 一律不允许

## 明确圆角

- sm: 4px / md: 8px / lg: 12px / xl: 16px / full: 9999
- 按钮 8px / 卡片 8px / Modal 12px / Avatar full

## 严禁出现的 AI UI 反模式（这条非常重要）

❌ 不要 emoji 作为功能图标（"🚀 快速开始" "⚡ 高性能"）
❌ 不要紫→粉→蓝的大范围渐变背景
❌ 不要毛玻璃（backdrop-blur）泛滥使用——只允许用在 Modal overlay 和悬浮下拉菜单
❌ 不要过度阴影——不要 box-shadow 带 30px+ blur 的"科技感" glow
❌ 不要"AI 神秘感" logo——六边形 / 神经网络 / 大脑 / DNA 图案都不要
❌ 不要 Hero 用 60px+ 超大字号
❌ 不要 "Coming soon" / "Powered by AI" 这类 placeholder 文案
❌ 不要按钮上的发光效果（glow / aura）
❌ 不要过度动效——不要"粒子飞舞""连线动画""浮动元素"

## 交互态要求（5 态全覆盖）

每个交互元素（Button / Input / Card / Link / Tab / Checkbox / Select / Switch）必须包含：
- default：默认态
- hover：背景亮度 +5%，严禁放大 / 严禁阴影变化
- active：背景亮度 -3%
- focus：2px ring，主色 @ 40% 透明度
- disabled：opacity 50% + cursor-not-allowed

## 响应式断点（5 档全适配）

- sm: 640px（手机）
- md: 768px（平板竖屏 / 分屏窗口）
- lg: 1024px（平板横屏 / 小笔记本）
- xl: 1280px（桌面）
- 2xl: 1536px（大屏）

每页必须在 md 和 lg 断点都有合理布局，不能只做 sm 和 xl。

## 空态 + 加载态

每个列表/数据区必须设计：
- 空态：线条风格 SVG 插画 + 15 字以内中文引导 + 一个主 CTA 按钮
- 加载态：骨架屏（skeleton pulse 动效），不要 spinner

## 技术栈

- Next.js 15 App Router（不要 Pages Router）
- Tailwind CSS v4（用 @theme 语法，不要 tailwind.config.js）
- shadcn/ui 组件库（预装 button / card / input / select / dialog / tabs 等常用组件）
- lucide-react 图标
- next/font 加载 Inter + Noto Sans SC + JetBrains Mono

## 产出要求

1. 完整的 Next.js 15 项目代码（pnpm 友好，pnpm install && pnpm dev 可直接运行）
2. 对应的 Figma 设计稿（7 页完整，包含所有交互态的 frame）
3. 所有页面间导航已连好（Next Link 组件）
4. 所有页面有 mock data 占位（放在 lib/mock-data.ts）
5. **默认暗色模式**，不做亮色模式切换（下半场再说）
6. 首页加一行隐藏注释 `{/* AgentHub · Generated by Prep-01 */}` 方便追溯

开始生成。生成过程中如遇不确定的细节，默认按"Linear + v0.dev 混合风格"判断。