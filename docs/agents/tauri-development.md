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

## 隐藏 webview 渲染通道（Cloudflare / 自建验证防护源）

- 实现在 `src-tauri/src/render.rs`：单例不可见窗口（label `render`）+ Rust 侧轮询；远程页面
  零 IPC 权限（capability 不覆盖 render 窗口），HTML 经宿主侧 `eval_with_callback` 取回。
- 布局细节、验证页识别与维护注意见 `docs/research/webview-render-channel.md`。

## 坑（Gotchas）

1. **Tauri 同步命令在主线程执行**：阻塞式 reqwest 必须放 async 命令 + `tauri::async_runtime::spawn_blocking`，否则冻结 UI。
2. **自定义 scheme 回调（cimoc-img://）**：macOS WKURLSchemeHandler 回调跑在主线程，同样需要 spawn_blocking。
3. **`withGlobalTauri` 必须放 `tauri.conf.json` 的 `app` 段**（不在 `security` 段；`app.withGlobalTauri: true`）。
4. **`on_page_load` 事件在 macOS 跨站重定向时会丢失**（纯 302 链一条 Finished 都不发）：页面就绪
   判定不要用它，改用 `eval_with_callback` 轮询 `location.href` + `readyState`（渲染通道的做法）。
5. **隐藏 webview 必须在主线程创建**：`run_on_main_thread` 调度后同步等结果（`render.rs::ensure_webview`）。
6. **隐藏渲染窗口会让「关掉全部窗口即退出」失效**：主窗口销毁时连带 destroy 渲染窗口
   （`lib.rs` 的 `on_window_event`）。
