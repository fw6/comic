# Tauri / 桌面开发约定

## 必读（处理任何 Tauri 任务前）

- Tauri 文档入口: <https://tauri.app/llms.txt> — **REQUIRED**。
- Tauri 插件（store/dialog/opener/fs 等）: <https://tauri.app/plugin/>
- Vite: <https://vite.dev/>

## 开发工作流

- 改前端（`desktop/src/`）：`npm run tauri dev` 热更新。
- 改 Rust 后端（`desktop/src-tauri/`）：改 Rust 触发后端重编，比前端慢。

## 图片加载（热链域必须走代理）

- 热链域（如 Webtoons pstatic.net）必须走 `cimoc-img://` 自定义 scheme 代理（Rust 加 Referer + 磁盘缓存/LRU）。
- 其余域 `<img>` 直连，吃 webview HTTP 缓存。
- 原因：macOS/Linux 无法给 `<img>` 注入 Referer，只能走代理。
- 详见 `docs/research/desktop-webview-images.md`。

## 坑（Gotchas）

1. **Tauri 同步命令在主线程执行**：阻塞式 reqwest 必须放 async 命令 + `tauri::async_runtime::spawn_blocking`，否则冻结 UI。
2. **自定义 scheme 回调（cimoc-img://）**：macOS WKURLSchemeHandler 回调跑在主线程，同样需要 spawn_blocking。
3. **`withGlobalTauri` 必须放 `tauri.conf.json` 的 `app` 段**（不在 `security` 段；`app.withGlobalTauri: true`）。
