# 前端（desktop/src）

Tauri v2 + React 19 + Vite 的前端。UI 由 Tailwind CSS v4 与 beui 组件构成。

## 样式与设计系统

- 设计令牌与全局基础样式：`desktop/src/styles/beui.css`（唯一的全局样式表，`main.tsx` 引入）。
  - 语义化颜色令牌（`--background` / `--foreground` / `--card` / `--primary` / `--muted-foreground` / `--border` …）在 Tailwind v4 的 `@theme inline` 里映射成 `bg-card`、`text-muted-foreground` 这类工具类。
  - 浅色写在 `:root`，深色写在 `[data-theme="dark"]`；主题由 `src/lib/theme.tsx` 的 `applyTheme()` 写 `html[data-theme]`。深色变体用 `@custom-variant dark` 绑定到该属性，不跟随系统 `prefers-color-scheme`。
  - 玻璃表面用 `.glass` / `.glass-strong` / `.glass-thin` 三个工具类；滚动条、选区、焦点环、安全区内边距都在这里统一定义。
- 设计系统的完整说明（配色、字体、圆角、动效、组件规范）：仓库根 `DESIGN.md`；机器可读令牌在 `.impeccable/design.json`。改配色或加组件前先看这两份。
- 字体是系统字体栈（中文界面用 PingFang SC / 微软雅黑），不引入网络字体。

## beui 组件

- 组件源码在 `desktop/src/components/beui/`，内部工具在 `desktop/src/lib/`（`utils.ts` 的 `cn`、`ease.ts` 的动效令牌、`hooks/`）。这些文件是上游源码的副本，`@/` 前缀指向 `src/`（vite.config.ts 的 alias + tsconfig paths）。
- 更新或新增组件：编辑 `desktop/scripts/fetch-beui.mjs` 的 `FILES` 清单，然后 `node scripts/fetch-beui.mjs`。脚本按清单精确写入，不会带进用不到的兄弟文件。
  - 脚本会自动应用两处适配（写在 `PATCHES` 里）：`theme-toggle` 的 `next-themes` 换成 `lib/theme`；`button/base` 导出类名映射，供 `LinkButton` 复用按钮样式。**不要手工改这两处**，会被重跑覆盖。
  - 组件目录：<https://beui.dev/llms.txt>，registry 索引 `https://beui.dev/r`。
- 应用自己的界面原语在 `src/components/ui.tsx`（封面、卡片、列表行、空状态、面板、进度条、`LinkButton`），页面直接组合这些与 beui 组件。

## 断点

窄屏断点是 **767px / 768px** 一条线，三处必须一致：

- `src/lib/platform.ts` 的 `MOBILE_QUERY`
- Tailwind 的 `md:`
- beui 侧边栏内部的 `MOBILE_QUERY`

## 阅读器的分页策略

`src/screens/Reader.tsx` 里每一页是「先占位、后收缩」：

- 未加载页用 `estimatePageHeight()` 预留高度（阅读列宽度 × 该源已加载页面的实测中位宽高比，`ratioSamples` 按源记忆）；比例变化小于 5% 不重建布局。
- 图片 `width: 100%; height: auto; loading="lazy"`，加载完成后释放预留高度。
- 长列表靠 `@tanstack/react-virtual` 虚拟化，滚到话末自动加载下一话（跨话连续）。

改这里时注意：预留高度参与虚拟器测量，测量值异常会直接表现为滚动跳动；`estimateSize` 与页面单元的 `minHeight` 必须用同一个估算值。

## 验证桌面界面（不使用截图）

应用内跑着 `tauri-plugin-mcp-bridge`（WebSocket 127.0.0.1:9223），可以用 `desktop/scripts/` 下的两个脚本在运行中的应用里读 DOM 与计算样式：

```bash
npm run tauri dev                       # 另开一个终端
node scripts/probe-app.mjs 'return document.body.innerText'
node scripts/probe-app.mjs --resize 420x820   # 切到移动端宽度再读一遍
node scripts/audit-contrast.mjs               # 逐路由扫文字对比度（深浅两套主题）
```

界面状态的判断走结构化文本（DOM、计算样式、可访问属性），不要用截图判断布局。改了配色或文字层级之后跑一次 `audit-contrast.mjs`。
