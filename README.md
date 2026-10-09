# 墨卷 · Tauri

墨卷漫画阅读器的桌面版（macOS / Windows / Linux），基于 **Tauri v2** + **React**（Vite web 前端）。Rust 核心 `mojuan-core` 承载爬虫引擎（Webtoons + MangaDex + Copymanga + 咚漫 + 漫画柜）与 WebDAV / 下载 / 本地扫描 / 图片缓存，数据层为真实图源链路，不含 mock。

> **2026-08 迁移**：原 Lynx（Sparkling）工程已按 big-bang 决定删除（`sparkling-cimoc/`、根 `src/ android/ dist/`），迁移决策轨迹见 wayfinder 地图：https://github.com/fw6/mojuan/issues/2

## 开发

```bash
cd desktop
npm install
npm run tauri dev
```

- 前端：`desktop/src/`（React + Vite + HashRouter）
- 后端：`desktop/src-tauri/`（Rust，tauri command 接线 mojuan-core）
- 核心：`desktop/crates/mojuan-core/`（爬虫 / WebDAV / 下载 / 本地扫描 / 图片缓存）

## 图片加载

- 热链域（Webtoons `pstatic.net`）：走本机图片代理（`127.0.0.1` 的 `/img` 端点，Rust 侧补 `Referer` + 磁盘缓存/LRU）
- 其余域：`<img>` 直连，吃 webview HTTP 缓存
- 详见 `docs/research/desktop-webview-images.md`

## 当前状态

- 骨架原型（wayfinder #5）与 Rust 核心迁移（#7）已完成并通过端到端验证。
- 桌面 v1 功能集已定案（grilling #6）：无限滚动阅读器（跨话连续、进度自动记录）、搜索、详情、Library（历史/收藏/下载/本地）、Settings 最小集；外链章节过滤。
- 领域术语表见 `GLOSSARY.md`；实现推进中。
