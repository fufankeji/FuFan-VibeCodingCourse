# Part1-02 AgentHub · Prep-03：UI 搬家指南


# 第一部分：为什么要搬家


## 1.1 先搞清楚 Figma Make 到底是什么工具

Figma Make 不是脚手架生成器，它是**UI 原型生成器**。它的定位是：

```
输入：一段自然语言的 UI 需求描述
输出：一个可以直接打开看效果的 UI 原型（Vite + React + Tailwind）
```

注意这里的关键词——**原型**。Figma Make 在架构上做了三个明确的选择：

| 决策点 | Figma Make 的选择 | 它为什么这么选 |
|--------|-----------------|--------------|
| 构建工具 | Vite（固定不可改） | 冷启动快，跑在浏览器里展示最流畅 |
| 路由方案 | React Router v7 | 纯前端路由，原型不需要服务端渲染 |
| 后端架构 | 无（纯前端） | 原型只需要可视化，不考虑 API / 流式 / 服务端数据 |

这些选择都是**正确**的——**对"出 UI 原型"这个目标而言**。你不能指望一个专门做原型的工具给你吐出一个生产级 SaaS 的完整脚手架，就像你不能指望 PPT 工具给你生成一个生产级演示平台一样。

**认清这个边界之后，结论很清楚：Figma Make 产出的代码，定位永远是"UI 原型"，不是"生产项目的起点"。**


# 第二部分：搬家总览

## 2.1 搬什么、不搬什么

| 类别 | 处理方式 | 原因 |
|------|---------|------|
| ✅ 所有 7 个页面的 JSX 结构 | 搬 | 这是 Figma Make 的核心产出 |
| ✅ shadcn/ui 组件库（`components/ui/*`）| 搬 | 约 40 个组件，完全复用 |
| ✅ `globals.css` / `theme.css` 的 @theme 配置 | 搬（合并成一份）| 设计 token 是我们的"视觉法衣" |
| ✅ mock data（`mock-data.ts`）| 搬 | 中文化过的假数据，直接用 |
| ✅ 图标（lucide-react）| 搬 | 组件库无需迁移，直接 import |
| ✅ `design-tokens.json` | 搬 | Prep-02 生成的规范化 token |
| ❌ `vite.config.ts` | 扔 | Next.js 有自己的配置 |
| ❌ `main.tsx` | 扔 | Next.js 用 `app/layout.tsx` 替代 |
| ❌ `App.tsx` + `routes.tsx` | 扔 | Next.js 用文件路由替代 |
| ❌ `react-router` 相关依赖 | 扔 | 换成 `next/link` / `next/navigation` |
| ❌ 未使用的万能依赖（MUI / motion / canvas-confetti / …）| 扔 | Figma Make 硬塞的，实际没用 |
| ❌ `fonts.css`（Google Fonts @import）| 扔 | 换成 `next/font/google`（更优） |
| ❌ `figma-asset-resolver` vite 插件 | 扔 | 代码里没用到 |

## 2.2 核心技术对应表（搬家时反复查这张表）

| React Router（当前） | Next.js App Router（目标） |
|---------------------|-------------------------|
| `src/app/App.tsx` + `RouterProvider` | 不存在（框架自动处理）|
| `routes.tsx` 的 `createBrowserRouter([...])` | 文件系统路由（`app/*/page.tsx`）|
| `{ index: true, element: <Landing /> }` | `app/page.tsx` |
| `{ path: "pricing", element: <Pricing /> }` | `app/pricing/page.tsx` |
| `{ path: "agent/:id", element: <AgentDetail /> }` | `app/agent/[id]/page.tsx` |
| `{ path: "*", element: <NotFound /> }` | `app/not-found.tsx` |
| `Root` 组件（带 Header + Outlet）| `app/layout.tsx` |
| `import { Link } from 'react-router'` | `import Link from 'next/link'` |
| `<Link to="/gallery">` | `<Link href="/gallery">` |
| `import { NavLink } from 'react-router'` | 自己包一层，用 `usePathname()` 判断 active |
| `import { useParams } from 'react-router'` | `import { useParams } from 'next/navigation'` |
| `const { id } = useParams()` | 直接从 props：`{ params }: { params: { id: string } }`（RSC）<br/>或保留 `useParams()`（Client Component）|

## 2.3 客户端组件标记（这条最容易漏）

Next.js 15 App Router **默认所有组件都是服务端组件**。任何页面只要用了以下任一特性，**必须在文件首行加 `"use client"`**：

- `useState` / `useEffect` / `useMemo` / `useCallback` / `useRef`
- `onClick` / `onChange` / `onSubmit` 等事件处理
- 浏览器 API（`window` / `localStorage` / `document`）
- `useRouter` / `usePathname` / `useSearchParams`

**当前项目里每个页面都需要标 `"use client"`**（因为都有交互状态）：

| 页面 | 需要 "use client"？ | 原因 |
|------|:-----------------:|------|
| Landing.tsx | ❌ 不需要 | 纯展示 |
| Pricing.tsx | ❌ 不需要 | 纯展示 |
| Gallery.tsx | ✅ 需要 | `useState(searchTerm)` / `useEffect` |
| AgentDetail.tsx | ✅ 需要 | `useState(prompt, isGenerating, output)` / `useParams` |
| RunHistory.tsx | ✅ 需要 | `useState` / `useEffect` |
| Settings.tsx | ✅ 需要 | `useState(activeTab)` |
| Pipeline.tsx | ✅ 需要 | `useState(selectedNode)` |
| Header（layout.tsx 里）| ✅ 需要 | `NavLink` 需要 `usePathname()` |
| Footer（layout.tsx 里）| ❌ 不需要 | 纯展示 |

---

# 第三部分：搬家 7 步

## Step 1：备份 + 起 Next.js 脚手架（5 分钟）

> **⚠️ 开工前必读——搬家里最常踩的两个坑**
>
> **坑 1：有 3 个文件是 create-next-app 预装的，你要"覆盖"不是"新建"**
> 下面步骤里的 `src/app/page.tsx`、`src/app/layout.tsx`、`src/app/globals.css`。搬家是把它们**覆盖掉**，而不是新建一个。如果漏覆盖，首页就会永远停留在 Next.js 默认欢迎页。
>
> **坑 2：搬完必须立刻 git commit 固化基线**
> 搬家过程会对脚手架的几个预装文件做修改。如果搬完后还没 commit 就做 `git reset --hard HEAD`，这些修改会被打回脚手架默认值——学员以为搬家失败了，其实只是被 reset 抹了。见本文件末尾 §Step 7.5 "固化基线"。
>
> **坑 3：`@latest` 会拉到 2026 年的 Next 16，而图纸示例是按 15 写的**
> 功能上 App Router 兼容；唯二需要注意的差异见本文件末尾 §第五部分"已知坑表"，搬前扫一眼就行，不用死记。

### 1.1 备份原项目

```bash
cd /Users/muyu/MuYuCourseSpace/MyAgentHub
cp -r "Start Project" "Start Project.backup-$(date +%Y%m%d)"
```

> **为什么**：一定要备份。搬家过程中可能会有"搬到一半发现不对、想回去参考"的时刻。`Start Project.backup-xxx` 就是你的"设计参考底稿"，永远不动。

### 1.2 在 MyAgentHub 目录下起 Next.js 15 新项目

```bash
cd /Users/muyu/MuYuCourseSpace/MyAgentHub

pnpm create next-app@latest agenthub \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-eslint \
  --no-turbopack \
  --import-alias "@/*" \
  --use-pnpm
```

> **2026-04 的版本说明**：`@latest` 现在拉到 **Next 16.x + React 19**（不是图纸写的 15）。功能上 App Router 兼容，但 Next 16 默认启用 Turbopack，部分 Google Font 子集（如 `Noto_Sans_SC`）build 时会失败——见 §Step 2.1 的变通。如果你想严格对齐图纸写 15，显式 pin：`pnpm create next-app@15.5 agenthub ...`。

各选项的意思：
- `--typescript`：用 TS（livecoding.md 的提示词都基于 TS）
- `--tailwind`：装 Tailwind v4（和当前项目对齐）
- `--app`：用 App Router 而不是 Pages Router
- `--src-dir`：代码放 `src/` 下（和当前项目结构一致）
- `--no-eslint`：先不开 ESLint（避免搬家过程中一堆警告干扰，后面可以开）
- `--no-turbopack`：先用稳定的 Webpack（Turbopack 在某些 shadcn 场景有兼容问题）
- `--import-alias "@/*"`：路径别名，和当前项目的 vite alias 一致

### 1.3 进入新项目，确认能跑

```bash
cd agenthub
pnpm dev
# 浏览器打开 http://localhost:3000，看到 Next.js 欢迎页 = 成功
# Ctrl+C 停掉
```

### 1.4 装 shadcn/ui 依赖（一次性装全）

当前项目 `components/ui/` 下有 40+ 个 shadcn 组件，它们依赖以下 Radix UI 库。直接从备份项目的 `package.json` 抄过来：

```bash
cd /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub

pnpm add \
  @radix-ui/react-accordion @radix-ui/react-alert-dialog \
  @radix-ui/react-aspect-ratio @radix-ui/react-avatar \
  @radix-ui/react-checkbox @radix-ui/react-collapsible \
  @radix-ui/react-context-menu @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu @radix-ui/react-hover-card \
  @radix-ui/react-label @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu @radix-ui/react-popover \
  @radix-ui/react-progress @radix-ui/react-radio-group \
  @radix-ui/react-scroll-area @radix-ui/react-select \
  @radix-ui/react-separator @radix-ui/react-slider \
  @radix-ui/react-slot @radix-ui/react-switch \
  @radix-ui/react-tabs @radix-ui/react-toggle-group \
  @radix-ui/react-toggle @radix-ui/react-tooltip

pnpm add \
  class-variance-authority@0.7.1 clsx@2 tailwind-merge@3.2.0 \
  tw-animate-css cmdk date-fns@3 lucide-react@0.487.0 \
  react-day-picker@8.10.1 react-hook-form react-resizable-panels@2.1.7 \
  recharts@2.15.2 sonner@2 embla-carousel-react input-otp vaul next-themes@0.4.6
```

> **为什么一次性装全**：shadcn 组件之间相互依赖（比如 `dialog` 依赖 `@radix-ui/react-dialog`，`alert-dialog` 依赖 `@radix-ui/react-alert-dialog`），漏装一个就编译报错。一次装全最省事。
>
> **⚠️ 版本必须 pin（这是 2026-04 踩过的坑）**：`@latest` 对这几个包会拉到和 Figma Make starter 不兼容的新版本——
> - `react-resizable-panels@4.x` 改了 API（没有 `PanelGroup`）→ pin `@2.1.7`
> - `date-fns@4.x` 改了 ESM 导出 → pin `@3`
> - `lucide-react@1.x` 是另一个包（不是同名图标库）→ pin `@0.487.0`
> - `recharts@3.x` 类型不兼容 → pin `@2.15.2`
> - `react-day-picker@9.x` 组件签名变了 → pin `@8.10.1`
> - `sonner@1` 和 `sonner@2` 导出不同 → pin `@2`
>
> Radix 包暂不用 pin（`@latest` 向后兼容）。想省心：直接把 `Start Project/package.json` 的 `"dependencies"` 复制到新项目的 `package.json` 再 `pnpm install`。

## Step 2：样式层迁移（5 分钟）

当前项目的样式分散在 `globals.css` + `theme.css` + `fonts.css` 三个文件，而且**两个文件里有重复的 @theme 定义**。搬家时合并成 `app/globals.css` 一份。

### 2.1 用 next/font 加载字体（替代 fonts.css 的 @import）

**覆盖** `src/app/layout.tsx`（这个文件是 create-next-app 预装的，里面是默认的 Geist 字体，要覆盖掉）：

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentHub · AI Agent 商店与 Playground",
  description: "下一代 AI Agent 构建、编排与分发平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

> **为什么用 next/font 而不是 @import**：
> 1. next/font 会**自动下载字体、内联到 build**，避免运行时请求 Google 服务器（国内用户加载快 3-5 秒）
> 2. 自动生成稳定的 font-family CSS 变量（`--font-inter` 等），避免 FOUT（无样式闪烁）
> 3. 自动 preload，首屏性能最优
>
> **关于中文字体（Noto Sans SC）**：
> 理想做法是再加一个 `Noto_Sans_SC`。但 **2026-04 在 Next 16 + Turbopack 下** `next/font/google` 对 Noto_Sans_SC 的 CJK 子集处理有 bug（build 时报 `module not found: noto_sans_sc_*.module.css`）——本图纸为了搬家能一次通过，暂时不加 Noto_Sans_SC，中文走系统 fallback（macOS: PingFang SC / Windows: Microsoft YaHei）。globals.css 的 `--font-sans` 要把这些 fallback 写进去（见下一节）。
>
> 等 Next 16 修这个 bug 之后，把 `Noto_Sans_SC` import 加回来即可（参考 `Start Project/src/styles/fonts.css` 里原来的 Google Fonts 加载方案）。

> **再次强调**（刚才开头坑 1 说过）：`src/app/layout.tsx` 脚手架已经给你生成了一份默认内容（Geist 字体 + 英文 metadata）。本步骤是**覆盖**这份默认内容，不是新建。一些学员看到已有文件会跳过这步——不要跳，一定要覆盖。

### 2.2 合并并重写 `src/app/globals.css`

用下面的内容**完整覆盖** `src/app/globals.css`（这是三个样式文件合并后的干净版）：

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme {
  /* ── Color / Background ──────────────────────────── */
  --color-bg-base:     hsl(220 15% 10%);
  --color-bg-subtle:   hsl(220 15% 13%);
  --color-bg-muted:    hsl(220 15% 17%);
  --color-bg-elevated: hsl(220 15% 22%);

  /* ── Color / Foreground ──────────────────────────── */
  --color-fg-default:   hsl(220 10% 95%);
  --color-fg-secondary: hsl(220 10% 70%);
  --color-fg-muted:     hsl(220 10% 50%);
  --color-fg-disabled:  hsl(220 10% 35%);

  /* ── Color / Primary ─────────────────────────────── */
  --color-primary-default: hsl(220 90% 60%);
  --color-primary-hover:   hsl(220 90% 65%);
  --color-primary-active:  hsl(220 90% 55%);
  --color-primary-fg:      hsl(0 0% 100%);

  /* ── Color / Status ──────────────────────────────── */
  /* 注意：命名必须是 status-success / warning / error，不能省略 status- 前缀——
     Figma Make 出的页面里用的是 bg-status-warning/10 这类 class，没有 status- 前缀
     Tailwind v4 找不到对应 token，会静默丢弃样式。 */
  --color-status-success: hsl(160 70% 50%);
  --color-status-warning: hsl(38 90% 55%);
  --color-status-error:   hsl(0 70% 60%);

  /* ── Color / Border ──────────────────────────────── */
  --color-border-default: hsl(220 15% 22%);
  --color-border-subtle:  hsl(220 15% 17%);
  --color-border-strong:  hsl(220 15% 30%);

  /* ── Typography / Font Family ────────────────────── */
  /* 中文 fallback 走系统字体（见 §2.1 关于 Noto_Sans_SC 的 Next 16 临时处置） */
  --font-sans: var(--font-inter), "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: var(--font-jetbrains-mono), monospace;

  /* ── Typography / Font Size ──────────────────────── */
  /* Scale: 12 / 13 / 14 / 15 / 16 / 18 / 20 / 24 / 30 / 36 */
  --text-xs:   12px;
  --text-sm:   13px;
  --text-base: 14px;
  --text-md:   15px;
  --text-lg:   16px;
  --text-xl:   18px;
  --text-2xl:  20px;
  --text-3xl:  24px;
  --text-4xl:  30px;
  --text-5xl:  36px;

  /* ── Spacing ─────────────────────────────────────── */
  /* 4px base scale: 0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 */
  --spacing-0:  0px;
  --spacing-1:  4px;
  --spacing-2:  8px;
  --spacing-3:  12px;
  --spacing-4:  16px;
  --spacing-5:  20px;
  --spacing-6:  24px;
  --spacing-8:  32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;

  /* ── Border Radius ───────────────────────────────── */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;
}

@layer base {
  * {
    /* 用 var(...) 不用 @apply：Tailwind v4 + Turbopack 对 @apply 自定义 @theme 工具类还不稳 */
    border-color: var(--color-border-default);
    outline-color: color-mix(in oklab, var(--color-primary-default) 40%, transparent);
    box-sizing: border-box;
  }

  body {
    background: var(--color-bg-base);
    color: var(--color-fg-default);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Link hover 下划线 transition */
  a {
    transition: all 200ms;
    text-decoration: underline transparent;
    text-underline-offset: 2px;
  }
  a:hover {
    text-decoration-color: currentColor;
  }

  /* Nav links 不需要下划线 */
  nav a {
    text-decoration: none;
  }
  nav a:hover {
    text-decoration: none;
  }
}
```

> **关键变化**：
> - `@import 'tailwindcss' source(none); @source '../**/*.{js,ts,jsx,tsx}';` → 换成标准 `@import "tailwindcss"`（Next.js 默认会扫 src 目录）
> - `var(--font-inter)` 等字体变量来自 `next/font/google` 注入到 `<html>` 上的 className
> - 删掉了 `theme.css` 里那套 `:root` + `@theme inline` 的双层写法，只保留单层 `@theme`（更简单、和 Prep-02 产出的设计 token 对齐）

## Step 3：shadcn/ui 组件库迁移（3 分钟）

### 3.1 复制整个 ui 目录

```bash
cp -r "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/components/ui" \
      "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/components/ui"
```

### 3.2 复制 utils.ts（shadcn 的 cn 函数）

```bash
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/lib/utils.ts" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/lib/utils.ts"
```

### 3.3 批量修正 ui 组件里的 import 路径

shadcn 组件里用的是 `@/components/ui/xxx` 和 `@/lib/utils` —— 在当前项目里 `@` 指向 `src/`，迁移到 Next.js 里 `@` 同样指向 `src/`，**路径别名是一致的**，不需要改。

但有个例外——shadcn `utils.ts` 里的 import：

```bash
# 检查一下迁移后有没有奇怪的 import 错误
cd /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub
grep -rn "from '\.\./\.\./" src/components/ui  # 找相对路径 import
grep -rn "from '@/app/" src/components/ui       # 找可能的 @/app/ 误引用
```

如果有命中，用 sed 批量替换：

```bash
# 如果有 '@/app/lib/utils' 这种引用，改成 '@/lib/utils'
find src/components/ui -name "*.tsx" -exec sed -i '' "s|@/app/lib/utils|@/lib/utils|g" {} +
```

### 3.4 安装 `figma/ImageWithFallback`（如果页面用到）

```bash
mkdir -p /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/components/figma
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/components/figma/ImageWithFallback.tsx" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/components/figma/ImageWithFallback.tsx"
```

## Step 4：布局层重构（5 分钟）

当前项目的布局在 `routes.tsx` 的 `Root` 函数里（Header + Outlet + Footer）——Next.js 把这个搬到 `app/layout.tsx`。

### 4.1 迁移 Header 和 Footer 到独立文件

先复制 `layout.tsx` 到新项目的 components 下：

```bash
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/components/layout.tsx" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/components/layout.tsx"
```

### 4.2 修改 `src/components/layout.tsx`——把 react-router 换成 Next.js

打开 `src/components/layout.tsx`，做两处替换：

**替换 1：import 语句**

```diff
- import { NavLink, Link } from 'react-router';
+ "use client";
+ import Link from 'next/link';
+ import { usePathname } from 'next/navigation';
  import { cn } from '../lib/utils';
```

> **注意**：第一行必须加 `"use client"`（因为 `usePathname` 是 Client-only hook）。

**替换 2：把 `<NavLink>` 换成 Next.js 自定义封装**

Next.js 没有内置的 `NavLink` 组件。在同一文件顶部加一个小封装：

```tsx
function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: (args: { isActive: boolean }) => string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link href={href} className={className ? className({ isActive }) : ''}>
      {children}
    </Link>
  );
}
```

**替换 3：把所有 `<Link to="...">` 改成 `<Link href="...">`**

全文替换：

```bash
sed -i '' 's|<Link to=|<Link href=|g' src/components/layout.tsx
sed -i '' 's|<NavLink\([^>]*\)to=|<NavLink\1href=|g' src/components/layout.tsx
```

### 4.3 重写 `src/app/layout.tsx`

把 Step 2.1 写好的字体加载代码和 Header/Footer 整合：

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import { Header, Footer } from "@/components/layout";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400","500","600","700"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", weight: ["400","500"], display: "swap" });
const notoSansSC = Noto_Sans_SC({ subsets: ["latin"], variable: "--font-noto-sans-sc", weight: ["400","500","600","700"], display: "swap" });

export const metadata: Metadata = {
  title: "AgentHub · AI Agent 商店与 Playground",
  description: "下一代 AI Agent 构建、编排与分发平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${jetbrainsMono.variable} ${notoSansSC.variable}`}>
      <body className="flex min-h-screen flex-col bg-bg-base font-sans text-fg-default antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

> **和原项目的区别**：原项目里 Footer 是有些页面（Landing/Pricing/Gallery/AgentDetail）才显示的，后台页（RunHistory/Settings/Pipeline）不显示。在 Next.js 里有两种做法：
> - **简单版**：layout.tsx 始终渲染 Footer（推荐，目测在后台页也不碍事）
> - **精细版**：后台页用**路由组**（`app/(dashboard)/runs/page.tsx` + `app/(dashboard)/layout.tsx`），让后台页共享一个无 Footer 的 layout
>
> **下半场只需要简单版**，Footer 始终显示足够用。路由组是进阶玩法，感兴趣的学员课后自己玩。

## Step 5：页面层迁移（10 分钟）

### 5.1 复制 mock-data.ts

```bash
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/lib/mock-data.ts" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/lib/mock-data.ts"
```

（`design-tokens.json` 和 `normalization-report.ts` 也一起复制过去，下半场可能用得上）

```bash
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/lib/design-tokens.json" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/lib/"
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/lib/normalization-report.ts" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/lib/"
```

### 5.2 逐页迁移（7 次）

Next.js 的路由是文件路径决定的。下面是对应表 + 每页的搬家命令：

#### Landing（首页 `/`）

```bash
mkdir -p /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/pages/Landing.tsx" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/page.tsx"
```

#### Pricing（`/pricing`）

```bash
mkdir -p /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/pricing
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/pages/Pricing.tsx" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/pricing/page.tsx"
```

#### Gallery（`/gallery`）

```bash
mkdir -p /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/gallery
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/pages/Gallery.tsx" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/gallery/page.tsx"
```

#### AgentDetail（`/agent/[id]` —— 动态路由）

```bash
mkdir -p /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/agent/\[id\]
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/pages/AgentDetail.tsx" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/agent/\[id\]/page.tsx"
```

#### RunHistory（`/runs`）

```bash
mkdir -p /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/runs
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/pages/RunHistory.tsx" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/runs/page.tsx"
```

#### Settings（`/settings`）

```bash
mkdir -p /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/settings
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/pages/Settings.tsx" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/settings/page.tsx"
```

#### Pipeline（`/pipeline`）

```bash
mkdir -p /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/pipeline
cp "/Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project/src/app/pages/Pipeline.tsx" \
   "/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/pipeline/page.tsx"
```

### 5.3 创建 404 页

```bash
cat > /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app/not-found.tsx <<'EOF'
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-[48px] text-center">
      <h1 className="text-[30px] font-bold text-fg-default mb-[8px]">404</h1>
      <p className="text-[14px] text-fg-secondary mb-[24px]">页面不见了</p>
      <Button asChild>
        <Link href="/">回首页</Link>
      </Button>
    </div>
  );
}
EOF
```

## Step 6：路由和导航批量重写（10 分钟）

这是搬家里**工作量最集中**的一步——要把每个页面里的 `react-router` 用法全部换成 Next.js 等价。

### 6.1 先给所有需要的页面加 `"use client"`

根据 §2.3 的判断表，需要加的页面是：Gallery / AgentDetail / RunHistory / Settings / Pipeline。

```bash
cd /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/src/app

# 批量加 "use client" 到文件首行
for file in gallery/page.tsx agent/\[id\]/page.tsx runs/page.tsx settings/page.tsx pipeline/page.tsx; do
  if ! head -1 "$file" | grep -q '"use client"'; then
    echo '"use client";' | cat - "$file" > /tmp/tmpfile && mv /tmp/tmpfile "$file"
    echo "✅ 加了 use client: $file"
  fi
done
```

### 6.2 批量替换 react-router → Next.js

**用 Claude Code / Cursor 执行以下提示词**（这是搬家里用 AI 省力的关键一步）：

```
请对以下 7 个文件批量做 react-router → Next.js App Router 的迁移。

文件列表：
- src/app/page.tsx
- src/app/pricing/page.tsx
- src/app/gallery/page.tsx
- src/app/agent/[id]/page.tsx
- src/app/runs/page.tsx
- src/app/settings/page.tsx
- src/app/pipeline/page.tsx

迁移规则（严格执行，不要擅自改动其他部分）：

1. import 替换：
   - 删除所有 `import { Link } from 'react-router';`
   - 删除所有 `import { useParams } from 'react-router';`
   - 删除所有 `import { Link, useParams } from 'react-router';`（合并的 import）
   - 在文件顶部（"use client" 指令之后，如果有的话）加：
     * 用到 Link 的文件加：`import Link from 'next/link';`
     * 用到 useParams 的文件加：`import { useParams } from 'next/navigation';`

2. JSX 属性替换：
   - 所有 `<Link to="...">` 改为 `<Link href="...">`
   - 所有 `<Link to={...}>` 改为 `<Link href={...}>`
   - 包括模板字符串形式：`<Link to={`/agent/${id}`}>` → `<Link href={`/agent/${id}`}>`

3. useParams 类型适配：
   - `const { id } = useParams();` 保留不变（Next.js 13+ useParams 签名兼容）
   - 如有 TS 报错，改为 `const { id } = useParams<{ id: string }>();`

4. 组件内部 import 路径（如 `../components/ui/button`）改为：
   - `../components/ui/button` → `@/components/ui/button`
   - `../lib/mock-data` → `@/lib/mock-data`
   - `../lib/utils` → `@/lib/utils`
   - `../components/figma/ImageWithFallback` → `@/components/figma/ImageWithFallback`
   
5. 其他保持不变：
   - 保留所有 Tailwind class
   - 保留所有 [Prep-02] 修复注释
   - 保留所有业务逻辑（useState/useEffect/handleSend 等）
   - 保留所有中文文案

每迁移完一个文件，在文件头部加一行注释：
// [Prep-03] Migrated from react-router to Next.js App Router

迁移后列出改动清单（文件 | 改了几处 Link | 改了几处 useParams | 改了几处 import 路径）。
```

> **为什么用 AI 批量做**：手动改 7 个文件的 `<Link>` 总共大概 30-40 处，手工容易漏或改错。让 AI 一次性做完 + 列出改动清单，你只需要 review 清单确认。

### 6.3 手动检查一个容易漏的点：AgentDetail 的 `/docs` 死链

**这个是 Prep-01 时代遗留的小 bug**——Landing 里有 `<Link to="/docs">查看文档</Link>`，但没有对应页面。搬家后的修法：

打开 `src/app/page.tsx`，把 `/docs` 链接改成外部文档占位：

```diff
- <Link to="/docs">查看文档</Link>
+ <Link href="https://agenthub.example.com/docs" target="_blank" rel="noopener noreferrer">查看文档</Link>
```

或者更简单——直接去掉这个按钮，改成一个 `<a href="#">查看文档</a>`：

```diff
- <Button variant="secondary" size="lg" asChild>
-   <Link to="/docs">查看文档</Link>
- </Button>
+ <Button variant="secondary" size="lg" asChild>
+   <a href="#" onClick={(e) => e.preventDefault()}>查看文档</a>
+ </Button>
```

## Step 7：启动验证（5 分钟）

### 7.1 启动 dev server

```bash
cd /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub
pnpm dev
```

### 7.2 逐页目视检查清单

打开浏览器，逐个访问以下 URL，对每一页做下面的检查：

```
□ http://localhost:3000/          （Landing）
  - Hero "浏览 Agent 商店" / "查看文档" 按钮存在
  - Stats Row 显示 "500+ 个 Agent / 1 万+ 开发者 / 5000 万+ 次运行 / 99.9% 可用性"
  - 精选 Agent 6 张卡片正常
  - 中文字体正常加载（不是默认宋体/fallback）
  
□ http://localhost:3000/pricing
  - 三档定价卡（免费版/专业版/团队版）
  - "最受欢迎" 标签出现在专业版卡上
  - FAQ 5 问展开
  
□ http://localhost:3000/gallery
  - 搜索框 placeholder 是 "搜索 Agent 名称、能力、作者…"
  - 分类筛选可点击
  - 骨架屏 → 卡片列表（1 秒过渡）
  
□ http://localhost:3000/agent/agent-1
  - 左侧 Agent 元信息卡
  - 右侧 Playground 能输入 + 点"发送"看到打字机模拟流式
  - 面包屑 "商店 / 开发工具 / 代码审查助手"
  
□ http://localhost:3000/runs
  - 左侧运行列表 10+ 条
  - 选中任意一条，右侧展示 Trace 瀑布图
  - 瀑布图 LLM/工具/检索 三色区分
  
□ http://localhost:3000/settings
  - 左侧 5 个 Tab（个人资料/API 密钥/账单/团队/集成）
  - 个人资料页有"存好"按钮
  - API Keys 空态有钥匙 SVG + "还没有 API Key"
  
□ http://localhost:3000/pipeline
  - 画布上 5 个节点 + 连线
  - 点击任一节点，右侧属性面板出现
  - LLM 节点选中后显示 Prompt 模板 textarea
```

### 7.3 常见搬家报错 & 修复

| 报错 | 原因 | 修复 |
|------|------|------|
| `Error: useState can only be used in Client Components` | 页面顶部没加 `"use client"` | 在文件第一行加 `"use client";` |
| `Module not found: Can't resolve 'react-router'` | 有 import 没换 | 全局搜 `react-router`，替换为 `next/link` / `next/navigation` |
| `Property 'to' does not exist on type 'LinkProps'` | `<Link to="...">` 没换成 `<Link href="...">` | 全局替换 |
| `Hydration mismatch` 警告 | 服务端和客户端渲染结果不一致，通常是 `Math.random()` / `Date.now()` 在 mock-data 里 | Mock 数据确定化（详见 §7.4）|
| 字体没加载（显示宋体）| `<html>` 上没挂 font variable | 检查 layout.tsx 的 `className={...}` 是否包含三个 variable |
| shadcn 组件样式丢失 | globals.css 里没 `@import "tw-animate-css"` | 补上 |

### 7.4 （可选）修 Hydration 警告

`mock-data.ts` 里有 `Math.random()` 和 `new Date(Date.now() - ...)`——这会导致服务端和客户端渲染出不同的数字，Next.js 会抛 Hydration mismatch 警告。

最简单的修法：在 mock-data 里把随机值换成固定种子。

打开 `src/lib/mock-data.ts`，在顶部加：

```ts
// [Prep-03] 修复 Hydration mismatch：确定化所有随机值
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}
const rand = seededRandom(42);
```

然后把文件里所有 `Math.random()` 替换成 `rand()`，`Date.now()` 用一个固定时间戳（比如 `1713600000000`）。

> **为什么推荐这么修**：Hydration 警告虽然不影响功能，但会**干扰后续 livecoding 调试**（控制台充斥警告，真的报错时看不到）。提前修了下半场清爽。

### 7.5 **固化基线**（⚠️ 最容易被漏的一步）

`pnpm dev` 验证通过、逐页目视检查合格之后，**立刻做下面这一步**：

```bash
cd /Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub
git add -A
git commit -m "migration complete: figma-make starter → next.js 15 app router"
```

> **为什么这一步最容易被漏**：`pnpm create next-app` 会给你一个自动初始化的 git 仓库 + 一条 "Initial commit from Create Next App" 提交。搬家过程中你对 `src/app/page.tsx`、`src/app/layout.tsx`、`src/app/globals.css` 这三个脚手架预装文件做了大量修改——**这些修改目前还在 "Changes not staged"**。如果你还没 commit 就跑了 `git reset --hard HEAD`（或任何自动化工具帮你 reset），这三个文件会被打回 create-next-app 默认内容，搬家功亏一篑：
> - `/` 首页 → 打回 Next.js 欢迎页（不是 Figma Make 的 Landing）
> - 根布局 → 打回 Geist 字体 + "Create Next App" 英文 metadata
> - 样式 → 打回 `--background/--foreground` 极简默认（所有 `bg-bg-base` / `text-fg-default` / `bg-primary-default` / `bg-status-warning` 都静默失效，页面变成灰白）
>
> 其他路由（`/pricing` / `/gallery` / ...）因为是**新目录**，untracked 文件 reset 不会动，所以看起来像 OK，只有首页坏了——坑大在"看起来只有一个小问题，但背后是一整类 scaffold 文件都没被守护"。
>
> **一句话：Step 7.5 不是可选，它是搬家的终点线。commit 不下去，前面六步都可能被一条 `reset` 抹平。**

---

# 第四部分：给 Claude Code 的"整体搬家提示词"（懒人包）

如果你想**一条命令让 Claude Code 自动跑整个搬家**，下面是打包版。打开 Claude Code，`cd` 到 `agenthub` 新项目目录，粘贴：

> **注意**：这只是 Step 3-6 的自动化版本。Step 1-2（备份、起脚手架、装依赖、改 globals.css + layout.tsx）**必须你先手动完成**，因为这涉及到 `pnpm create next-app` 交互式脚手架，AI 自动化不了。

```
你是这个项目的工程师。我刚用 create-next-app 起了这个 Next.js 15 App Router 项目，
现在要把 /Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project 的 Figma Make 产出
搬家过来。具体任务：

【搬家源】 /Users/muyu/MuYuCourseSpace/MyAgentHub/Start Project
【搬家目标】当前项目（/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub）

任务清单（按顺序执行，每步做完汇报一次）：

一、shadcn/ui 组件库迁移
1. 复制源项目 src/app/components/ui/ 全部文件到 src/components/ui/
2. 复制源项目 src/app/lib/utils.ts 到 src/lib/utils.ts
3. 复制源项目 src/app/components/figma/ImageWithFallback.tsx 到 src/components/figma/ImageWithFallback.tsx
4. 检查并修正 import 路径：任何指向 @/app/lib/utils 的改成 @/lib/utils

二、布局层
5. 复制源项目 src/app/components/layout.tsx 到 src/components/layout.tsx
6. 在 layout.tsx 顶部加 "use client"
7. 把 import { NavLink, Link } from 'react-router' 替换为：
   - import Link from 'next/link'
   - import { usePathname } from 'next/navigation'
8. 在 layout.tsx 中添加一个本地 NavLink 封装组件（用 usePathname 判断 active）
9. 把所有 <NavLink to="..."> 和 <Link to="..."> 改为 href="..."

三、数据层
10. 复制源项目 src/app/lib/mock-data.ts 到 src/lib/mock-data.ts
11. 复制源项目 src/app/lib/design-tokens.json 到 src/lib/design-tokens.json
12. 复制源项目 src/app/lib/normalization-report.ts 到 src/lib/normalization-report.ts
13. 在 mock-data.ts 中把所有 Math.random() 替换为 seededRandom(42) 的 rand()，
    把 Date.now() 替换为固定时间戳 1713600000000，消除 Hydration mismatch

四、页面层
14. 按以下映射复制 7 个页面：
    - Landing.tsx      → src/app/page.tsx
    - Pricing.tsx      → src/app/pricing/page.tsx
    - Gallery.tsx      → src/app/gallery/page.tsx
    - AgentDetail.tsx  → src/app/agent/[id]/page.tsx
    - RunHistory.tsx   → src/app/runs/page.tsx
    - Settings.tsx     → src/app/settings/page.tsx
    - Pipeline.tsx     → src/app/pipeline/page.tsx

15. 对 Gallery / AgentDetail / RunHistory / Settings / Pipeline 这 5 个页面，
    在文件第一行加 "use client"

16. 对所有 7 个页面执行以下批量替换：
    - 删除 `import { Link } from 'react-router';`（单独或合并）
    - 删除 `import { useParams } from 'react-router';`
    - 加上 `import Link from 'next/link';`（用到 Link 的文件）
    - 加上 `import { useParams } from 'next/navigation';`（用到 useParams 的文件）
    - 所有 <Link to="..."> 改为 <Link href="...">
    - 所有相对路径 import（../components/... / ../lib/...）改为 @/... 绝对路径
    - 在每个文件顶部加一行注释：
      // [Prep-03] Migrated from react-router to Next.js App Router

17. 创建 src/app/not-found.tsx（404 页），内容是一个居中的"页面不见了"卡片

五、启动验证
18. 跑 pnpm dev，检查 stderr 有没有报错
19. 用 curl http://localhost:3000 简单验证首页能返回 200

六、汇报
20. 列出一张"改动统计表"：
    | 文件 | 加了 "use client" | 替换了几处 Link | 替换了几处 import 路径 |
    |------|:---:|:---:|:---:|
    
完成每一大步后，运行一次 pnpm build 看有没有类型错误。有错误立即停下来告诉我。
不要擅自修改业务逻辑、Tailwind class、中文文案、[Prep-02] 注释。
```

---

# 第五部分：搬家完成后的最终验证清单

```
□ 项目结构正确
  □ src/app/{page,pricing/page,gallery/page,agent/[id]/page,runs/page,settings/page,pipeline/page,not-found,layout,globals.css}
  □ src/components/{ui/*,figma/ImageWithFallback,layout}
  □ src/lib/{utils,mock-data,design-tokens.json,normalization-report}

□ 启动和构建
  □ pnpm dev 无报错启动
  □ pnpm build 无类型错误通过
  □ 浏览器控制台无 Hydration mismatch 警告

□ 页面检查（7 个路由全部访问 + 目视）
  □ / 首页 UI 和 Figma Make 版本一致
  □ /pricing 三档定价卡
  □ /gallery 筛选 + 卡片
  □ /agent/agent-1 左右布局 + Playground
  □ /runs Trace 瀑布图
  □ /settings 5 个 Tab
  □ /pipeline 节点画布

□ 交互检查
  □ 顶部导航高亮当前页
  □ Playground "发送" 按钮能触发打字机效果
  □ Gallery 搜索/筛选生效
  □ Settings Tab 切换

□ 视觉对齐检查
  □ 暗色模式默认生效
  □ 中文字体（思源黑体）正常加载
  □ 所有状态色（蓝/绿/黄/红）显示正确
  □ 间距和圆角和 Figma Make 版本一致

□ 中文化完整
  □ 没有 Browse / Get Started / Submit / Save 等英文按钮
  □ 404 页显示"页面不见了"
  □ 所有空态中文
```