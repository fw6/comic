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

- 判据在 cimoc-core（`crawler/render.rs`）：`STATE_SCRIPT` / `HTML_SCRIPT` / `is_clean` / `is_denied`
  与 `POLL_INTERVAL` / `RENDER_TIMEOUT`。挑战页形态变化只改这里，桌面与移动端同时生效。
- 桌面端：`src-tauri/src/render.rs`，单例不可见窗口（label `render`）+ Rust 侧轮询；远程页面
  零 IPC 权限（capability 不覆盖 render 窗口），HTML 经宿主侧 `eval_with_callback` 取回。
- 移动端：`crates/tauri-plugin-cimoc-render/`（自建 tauri 插件，Kotlin `WebView` / Swift `WKWebView`
  离屏加载）。状态脚本 / 取 HTML 脚本 / 轮询间隔 / 整体超时随请求下发，原生侧只做「加载 → 轮询 →
  连续两次干净 → 取 HTML」，不含任何站点选择器。
- 布局细节、验证页识别、移动端离屏 webview 的取舍与维护注意见 `docs/research/webview-render-channel.md`。

## 坑（Gotchas）

1. **Tauri 同步命令在主线程执行**：阻塞式 reqwest 必须放 async 命令 + `tauri::async_runtime::spawn_blocking`，否则冻结 UI。
2. **自定义 scheme 回调（cimoc-img://）**：macOS WKURLSchemeHandler 回调跑在主线程，同样需要 spawn_blocking。
3. **`withGlobalTauri` 必须放 `tauri.conf.json` 的 `app` 段**（不在 `security` 段；`app.withGlobalTauri: true`）。
4. **`on_page_load` 事件在 macOS 跨站重定向时会丢失**（纯 302 链一条 Finished 都不发）：页面就绪
   判定不要用它，改用 `eval_with_callback` 轮询 `location.href` + `readyState`（渲染通道的做法）。
5. **隐藏 webview 必须在主线程创建**：`run_on_main_thread` 调度后同步等结果（`render.rs::ensure_webview`）。
6. **隐藏渲染窗口会让「关掉全部窗口即退出」失效**：主窗口销毁时连带 destroy 渲染窗口
   （`lib.rs` 的 `on_window_event`）。
7. **移动端插件的原生工程由构建脚本接入**：插件 `build.rs` 里 `tauri_plugin::Builder::new(&[..])
   .android_path("android").ios_path("ios")` 就够了——app 的 `tauri-build` 会把插件写进
   `gen/android/tauri.settings.gradle` 与 `app/tauri.build.gradle.kts`（iOS 侧经
   `link_apple_library` 链进 Xcode 工程）。Android 类名不必叫 `app.tauri.*`：release 混淆下靠
   tauri-android 的 consumer rules（`-keep @TauriPlugin` / `-keep @InvokeArg`）保留。
8. **移动端原生命令可能不在主线程**：Android 的 `@Command` 与 iOS 的插件调度都不保证主线程
   （iOS 在 tauri 的 ipc 队列上），创建/操作 WebView 一律先切主线程（渲染插件用
   `Handler(Looper.getMainLooper())` / `DispatchQueue.main.async`）。
9. **Xcode 27 上构建 iOS 目前走不通（上游 swift-rs 的坑）**：Xcode 27 的 SwiftPM 会把静态产物里的
   `@_cdecl` 符号内化成局部符号，链接 Rust 侧时报 undefined symbols（`_register_plugin`、
   `_init_plugin_*`、`_retain_object` …，与具体插件无关）。swift-rs 1.0.8 起用
   `llvm-objcopy --globalize-symbol` 修补，但它 ① 需要 `rustc` 在 Xcode 脚本阶段的 PATH 上
   （脚本阶段看不到 `~/.cargo/bin`，本机做法：`ln -s ~/.cargo/bin/rustc node_modules/.bin/rustc`
   并已装 `rustup component add llvm-tools`），② 只修补包自己的目标文件成员，跳过内嵌的
   `SwiftRs.o`，所以 `_retain_object` / `_release_object` / `_string_from_bytes` 仍缺。CI 的
   Xcode 26 不受影响；另外工程部署目标 14.0 低于 Xcode 27 支持的 15.0，用 27 时需在
   `tauri.conf.json` 的 `bundle > iOS > minimumSystemVersion` 抬高（或 `ios init` 后改
   `gen/apple/project.yml`）。
