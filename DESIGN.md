---
name: Cimoc
description: 中文漫画阅读器桌面应用——中性底色、单一蓝色强调、弹簧动效
colors:
  background: "oklch(99% 0 0)"
  background-dark: "#151515"
  card: "oklch(97% 0 0)"
  card-dark: "#1c1c1c"
  foreground: "oklch(15% 0 0)"
  foreground-dark: "oklch(96% 0 0)"
  muted-foreground: "oklch(50% 0 0)"
  muted-foreground-dark: "oklch(66% 0 0)"
  primary: "#0560c0"
  primary-dark: "#2f9dff"
  accent-cyan: "oklch(56% 0.15 195)"
  accent-cyan-dark: "oklch(80% 0.18 195)"
  destructive: "oklch(52% 0.2 25)"
  success: "oklch(48% 0.16 155)"
  warning: "oklch(52% 0.16 75)"
  border: "oklch(15% 0 0 / 0.08)"
  border-dark: "rgb(255 255 255 / 0.07)"
  border-strong: "oklch(15% 0 0 / 0.14)"
  ring: "oklch(56% 0.15 195)"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Cascadia Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  panel: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "40px"
  nav-item-active:
    backgroundColor: "oklch(95% 0 0)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "36px"
  chapter-tile:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  chapter-tile-current:
    backgroundColor: "color-mix(in oklab, #0560c0 12%, transparent)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  cover:
    backgroundColor: "oklch(95% 0 0)"
    rounded: "{rounded.lg}"
    width: "2 / 3 aspect"
  toast-surface:
    backgroundColor: "oklch(100% 0 0)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
---

# Design System: Cimoc

## Overview

**Creative North Star: "安静的取景框"**

阅读器是唯一的主角，界面是它的取景框。除阅读页之外的每一屏都保持中性：近白的底、低对比的分隔线、没有纹理的背景，让封面和页面成为画面里唯一有颜色的东西。控件带一点手感——按压回弹、指示器滑动、面板展开——但都不持续、不循环、不吸引注意力。

配色只有一处声音：蓝色 `primary` 独占"当前项"和"主要动作"，其余全部落在灰阶上。它是操作型界面该有的做法，读者来这里是看漫画的，不是看界面的。浅色是默认主题（白天、室内、与人共用屏幕），深色供夜间与长时间阅读，两者共用同一套语义令牌。

**Key Characteristics:**

- 中性灰阶底 + 单一蓝色强调，无渐变、无纹理、无彩色分区
- 圆角分三档：控件用全圆角药丸，卡片 12–16px，大面板 24px
- 深度靠色调分层（card 在 background 之上），不靠阴影
- 动效只在元素"移动位置"或"换内容"时出现，用弹簧曲线，进场位移 ≤12px
- 移动端（<768px）换用顶部栏 + 底部标签栏，桌面侧边栏可折叠成图标轨道

## Colors

整套颜色用 OKLCH 定义，透明度写在颜色里（分隔线是半透明的墨，而不是固定的灰）。

### Primary

- **信号蓝** (#0560c0，深色主题下为 #2f9dff)：当前选中的导航项与标签页、页面主按钮、进度条、当前章节的描边。浅色主题的蓝色比 beui 原生的 #0285f7 深一档，为的是白字落在按钮上有 6.1:1、蓝字落在自己的 12% 浅底上仍有 5.0:1；深色主题把亮度提到 #2f9dff 并给文字配深蓝底 (#08243c)，在 #151515 上是 5.6:1。

### Secondary

- **青绿强调** (oklch(56% 0.15 195)，深色下 oklch(80% 0.18 195))：焦点环、`accent` 标签的底色。它作描边与底纹，不作文字色——浅色主题下它在自己 25% 的浅底上只有 3:1 量级，文字一律用 `--foreground`。

### Tertiary

- **语义色**：危险 oklch(52% 0.2 25)、成功 oklch(48% 0.16 155)、警示 oklch(52% 0.16 75)。深度按「落在自身 10–12% 浅底上仍 ≥4.5:1」选取，因此浅色主题下它们是稳重的深色，深色主题下才提到高亮度。只出现在状态徽章、错误横幅、下载进度这三处。

### Neutral

- **纸白** (oklch(99% 0 0))：浅色主题的页面底。
- **墨黑** (oklch(15% 0 0))：浅色主题的正文。深色主题的底是固定值 #151515，卡片 #1c1c1c，正文 oklch(96% 0 0)。
- **次级文字** (oklch(50% 0 0) / 深色 oklch(62% 0 0))：作者名、说明、时间戳。
- **分隔线** (oklch(15% 0 0 / 0.08))：同一层级里所有边框都从这里取。
- **强分隔线** (oklch(15% 0 0 / 0.14))：滚动条滑块、输入框描边。

### Named Rules

**The One Voice Rule.** 蓝色只用来标记"当前"和"主操作"，任何一屏里它的面积不超过 10%。它一旦变成装饰，读者就找不到真正需要点的地方。

**The Color Carries Meaning, Not Text Rule.** 语义色负责图标、圆点、描边与底纹；需要成段文字时，文字用 `--foreground`，颜色留给它旁边的图标。状态徽章是唯一例外——它的文字短且必须能被颜色区分，所以浅色主题的语义色按"落在自身浅底上 ≥4.5:1"取深度。

**The Ink, Not Gray Rule.** 浅色主题的边框一律是半透明的墨（`oklch(15% 0 0 / 0.08)`），不是固定灰。深色主题对应半透明白。

## Typography

**Body Font:** 系统界面字体栈（`ui-sans-serif, system-ui, -apple-system, PingFang SC, Microsoft YaHei, Noto Sans SC`）
**Mono Font:** `ui-monospace, SF Mono, Menlo`

**Character:** 中文界面用系统字体是正确选择——读者对汉字字形的熟悉度高过任何品牌字体，且不引入字体下载。声音由字号与字重承担：同一族里 600 与 400 拉开层级，不用斜体、不用衬线。

### Hierarchy

- **Headline** (600, 24px, 1.2, -0.02em)：每个页面的标题，全应用只有一处。
- **Title** (600, 14px)：面板标题、卡片标题、列表行主标题。
- **Body** (400, 14px, 1.5)：正文与简介；简介行长自然限制在 65ch 以内。
- **Label** (500, 12px)：说明、作者、时间戳、计数。
- **Mono** (400, 12px)：版本号、路径、章节 URL。

### Named Rules

**The Two Weights Rule.** 只有 400 和 600 两档字重。中间态用颜色（次级文字）区分，不用 500 去凑层级。

**The One Entrance Rule.** 全站只有一种进场动效：滚动到视口时位移 12px、从 6px 模糊里显出，同排按列位错开 40ms 以内，`once` 只播一次。列表与网格共用它，不另立第二种。

## Layout

桌面端是固定的两栏：左侧边栏 16rem（折叠后 4.25rem 图标轨道），右侧内容区自己滚动。内容区居中容器按页面取宽：书源 1152px、详情 1024px、下载 896px、设置 768px；移动端一律满宽加 16px 内边距。

移动端（<768px）是单栏：顶部玻璃栏（返回 / 标题 / 搜索 / 主题）、可滚动内容、底部标签栏 62px（含安全区内边距）。

阅读器只有一栏：居中阅读列，宽 720px，图片宽度 100%、高度自适应、加载前预留高度。任何页面都不产生横向滚动。

间距节奏是 4px 基准的倍数：同组内 8–12px，组之间 16px，区块之间 32px。列表用 8px 间距的紧凑分组，网格用 16px。

## Elevation & Depth

深度靠色调分层：`card` 铺在 `background` 上就已经分层，绝大多数表面没有阴影。只有三类表面浮起来——命令面板与轻提示这类由浮层组件自己绘制的面板、阅读器的操作栏、悬停时的封面——它们用带偏移和模糊的阴影（`0 25px 50px -12px`、`0 10px 15px -3px`），不是零偏移的彩色光晕。

### Shadow Vocabulary

- **glass** (`0 25px 50px -12px rgb(0 0 0 / 0.25)`): 命令面板、操作栏、轻提示——真的浮在内容之上，因此配 `backdrop-blur` 也是真的透过内容。
- **lift** (`0 10px 15px -3px rgb(0 0 0 / 0.1)`): 封面悬停。
- **none**: 页面级的顶栏、底栏、阅读器栏一律实底 `--background` 加 1px 分隔线。

### Named Rules

**The Glass Over Content Rule.** 模糊只在内容真的从它下方滚过时使用（浮层、命令面板、轻提示）。与滚动内容并排的栏用实底；静止的卡片不配模糊。

**The One Declarer Rule.** 一个表面要么有描边要么有阴影，不在静态状态下同时用两者；封面静止时只有 1px 描边，阴影留给悬停。

## Shapes

控件是药丸（`9999px`）：按钮、标签、徽章、输入框、进度条。卡片是 16px，章节块与缩略图这类小内联元素是 12px，面板是 24px。边框永远 1px，颜色来自分隔线令牌。

图标统一用 lucide 的线性图标，尺寸 14/16/20px 三档，描边粗细一致；不用 emoji、不用 Unicode 字符充当图标。封面固定 2:3 的宽高比，阅读页保留图片自身比例。

## Components

### Buttons

- **Shape:** 药丸（`9999px`），高度 32 / 40 / 48px 三档。
- **Primary:** 信号蓝底 + 白字；一屏只出现一次。
- **Secondary:** 卡片底 + 1px 描边 + 正文色，用于次一级动作（重试、恢复、选择文件夹）。
- **Ghost:** 无底，悬停时才出现底色，用于图标按钮与工具栏。
- **Hover / Focus:** 悬停 1.02 倍、按下 0.93 倍，弹簧 500/30/0.6；焦点环是 2px 青色描边，偏外 2px。
- **Disabled:** 降到 50% 不透明度并去掉指针事件，不加灰底。

### Chips

- **Style:** 24px 高的药丸，背景 `muted`，文字次级色。
- **State:** `accent` 变体用青色的 15% 底；`primary` 变体用蓝色的 12% 底标记当前源。

### Cards / Containers

- **Corner Style:** 16px（卡片）/ 24px（面板）。
- **Background:** `card`（浅色 oklch(97% 0 0)）。
- **Border:** 1px 分隔线，静态状态不加阴影。
- **Internal Padding:** 10–20px，按密度取。

### Inputs / Fields

- **Style:** 44px 高，卡片底，1px 分隔线，药丸圆角。
- **Focus:** 青色 2px 焦点环；错误态用危险色描边并从左侧抖一下。

### Navigation

桌面侧边栏：品牌在顶部，导航项 36px 高、12px 圆角、图标 16px 加 10px 文字；当前项用 `secondary` 底滑动过渡（弹簧 360/32/0.6），侧边栏可折叠成 4.25rem 的图标轨道，⌘B 切换。移动端底部标签栏：图标 20px 加 11px 文字，当前项同样是滑动底色。

### Reader Page Cell（签名组件）

阅读器的每一页是一个"先占位、后收缩"的单元：加载前用预估高度（列宽 × 该源已加载页面的实测中位宽高比）撑住布局，图片 `loading="lazy"`，加载完成后释放预留高度、按图片自身比例撑开。加载中显示页序号与点状加载指示；重试耗尽后就地显示"点击重试"。章节的第一页上方带一条章节标题分隔，跨话连续阅读时提供方位感。

### Command Palette

⌘K 唤起，玻璃面板，按组列出页面、书源、外观命令，当前行用滑动底块标记；移动端顶栏的搜索按钮打开同一个面板。

## Do's and Don'ts

### Do:

- **Do** 用蓝色标记"当前项 + 主操作"，一屏不超过 10% 面积。
- **Do** 让图片先占位再加载：容器先有预估高度，图片到达后才改变自身高度。
- **Do** 用 `card` 底 + 1px 描边表达层级；需要浮起来时才加阴影。
- **Do** 用弹簧曲线表达位置变化（360/32/0.6），一次性进场用 ease-out。
- **Do** 尊重 `prefers-reduced-motion`：位移与缩放降为不透明度变化。
- **Do** 给滚动条、选区、焦点环、等宽数字都套上令牌。

### Don't:

- **Don't** 用渐变文字、彩色光晕阴影、`border-left` 彩条。
- **Don't** 给静止的卡片同时加描边和阴影。
- **Don't** 把玻璃模糊用在不会滚动的内容上。
- **Don't** 用 emoji 或 Unicode 字符替代图标。
- **Don't** 在中文界面里用非系统字体做正文。
- **Don't** 引入第三种字重或第二个强调色。
