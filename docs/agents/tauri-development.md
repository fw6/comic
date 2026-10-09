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

## 自动更新通道（`updater/`）

- 桌面端用官方 tauri-plugin-updater；`plugins.updater.endpoints` 指向
  `https://cimoc-updater.fengw.site/latest.json`，服务是 `updater/` 里的 Cloudflare Worker。
- 仓库私有，GitHub Releases 对未登录客户端一律 404，所以清单与制品都由 Worker 用
  `GITHUB_TOKEN` 从 GitHub Releases 取回后对外提供；只提供 GitHub 判定的「最新已发布
  版本」，draft release 在人工 publish 之前不对外。
- `*.workers.dev` 在本机所在网络连不上（实测 443 超时，而 Cloudflare 边缘 IP 与
  github.com 都通），所以 Worker 挂在自有域名的子域下，与 `blog.fengw.site` 同一做法。
- 改了 `updater/src/` 或 `updater/wrangler.toml` 要 `cd updater && npx wrangler deploy`；
  密钥、发布开关与撤掉步骤见 `updater/README.md`。

## Android OTA（应用内升级）

官方 `tauri-plugin-updater` 在移动端是空实现（`package.metadata.platforms.support.android
= "none"`，`install_inner` 直接返回 `Ok(())`），所以 Android 另走一条：

- 分层：清单拉取 / 版本比对（semver）/ 下载 / sha256 校验在 cimoc-core 的 `native/ota.rs`
  （与平台无关、可单测）；状态机与命令在 `src-tauri/src/ota.rs`（`ota_check` /
  `ota_download` / `ota_install` / `ota_can_install` / `ota_open_install_settings`，只在
  移动端编译并注册，见 `lib.rs` 的 `#[cfg(mobile)]`）；安装是自建插件
  `crates/tauri-plugin-cimoc-update/`（Android Kotlin `PackageInstaller`，iOS Swift 三个
  命令都回「不支持」）。
- 通道地址在 `tauri.conf.json` 的 `plugins.cimoc-update.endpoint`，与桌面端的
  `plugins.updater.endpoints` 并列；Rust 侧经 `app.config().plugins` 读原始 JSON，不走
  插件的 `getConfig`。
- **签名是这条路的前提**：Android 只允许同签名的包覆盖安装，CI 用 secret
  `ANDROID_KEYSTORE_BASE64` 里的固定密钥签名（`release.yml` 的 sign APK 步骤）。客户端
  在交出去之前用 `getPackageArchiveInfo(..., GET_SIGNING_CERTIFICATES)` 比一次签名，
  不一致直接报「需要先卸载再安装」，不让用户走完系统安装器再看一句看不懂的失败。
- 权限与接收器声明在**插件模块的** `android/src/main/AndroidManifest.xml` 里
  （`REQUEST_INSTALL_PACKAGES` + `InstallResultReceiver`）：Gradle 合并进应用 manifest，
  而 `gen/android` 每次 `tauri android init` 都会重建，写在那里会丢。
- 安装会话的状态经 `PendingIntent` 广播回来，所以接收器要写进 manifest，并由插件模块的
  `consumer-rules.pro` 保留（类名只出现在 manifest 与 Intent 里，R8 看不到静态引用）；
  `@TauriPlugin` / `@InvokeArg` 类仍由 tauri-android 的 consumer rules 保留。
- 建会话要把整个 APK 拷进安装器存储（几十兆），这一步放后台线程；`startActivity` 拉起
  安装确认界面与 `invoke` 结算回主线程。
- 本机验证 Android 目标的编译用 `scripts/check-android.sh`（宿主 `cargo check` 看不到
  `#[cfg(mobile)]` 的代码，`ota.rs` 与插件的 `mobile.rs` 都在其中；CI 的 `cargo test`
  同样覆盖不到，release.yml 的 build-android 作业才是这道门槛）。

### 端到端验证（模拟器，不需要真机与线上通道）

整条链路在模拟器上跑通过（API 37 arm64），做法如下：

1. 起模拟器（`emulator -avd <名字> -no-window -gpu swiftshader_indirect`），关掉安装校验
   与动画：`settings put global package_verifier_enable 0`、`verifier_verify_adb_installs 0`。
2. 在主机上用一个静态 HTTP 服务当更新通道，目录里放 `android.json` 与 APK。**`url` 要写
   绝对地址**——真实通道里这一步是 Worker 把清单里的文件名改写成自己的 `/dl` 路径，客户端
   只接受完整 URL。
3. `adb reverse tcp:<端口> tcp:<端口>`：设备侧的 127.0.0.1 指向主机的这个服务（构建时的
   `--config` 把 endpoint 指到 `http://127.0.0.1:<端口>/android.json`）。
4. 构建时用 `--config` 覆盖 `plugins.cimoc-update.endpoint` 与 `version`，**不改任何源码**：
   `npx tauri android build --apk --debug --target aarch64 --config override.json`。
5. `adb install` 旧版本（调试包）；再构建新版本的**发布包**并用同一个密钥签名
   （`apksigner sign --ks ~/.android/debug.keystore --ks-key-alias androiddebugkey`），
   放进通道目录。调试包有 240 MB 上下，下载会顶到探针超时，发布包只有 20 MB 左右。
6. 驱动：`adb forward tcp:<主机口> tcp:9223`（注意方向：桥是**设备端**服务，用 forward；
   本地通道是**主机端**服务，用 reverse），再用 `desktop/scripts/probe-app.mjs` 调 `ota_*`
   命令；界面路径直接在设置页点「检查新版本 → 下载 → 安装」。
7. 系统确认界面用 `adb shell uiautomator dump` 取结构化文本找按钮（不要截图）；
   `adb shell dumpsys package io.github.fw6.cimoc | grep versionName` 核对版本是否变化。

模拟器带 Play 商店时，安装前会弹 Play Protect 的「扫描应用」，挡住系统确认界面；
`adb shell pm disable-user --user 0 com.android.vending` 关掉它即可（验完 `pm enable` 还原）。

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
10. **自建插件的配置类型必须声明，否则应用启动即 panic**：`tauri::plugin::Builder::new(name)`
    的配置类型默认是 `()`，而 tauri 在插件初始化时会按这个类型反序列化 `tauri.conf.json` 的
    `plugins.<name>` 段——只要那里放了一个对象，启动时就报
    `PluginInitialization(.. invalid type: map, expected unit)` 并直接 abort。要么用
    `Builder::<R, Config>::new(name)` 声明配置类型（`Config` 的字段加 `#[serde(default)]`），
    要么别在 `plugins` 下给它写配置。`cargo check` 与 `cargo test` 都发现不了，只有把应用跑起来
    才会暴露；`crates/tauri-plugin-cimoc-update/src/lib.rs` 里有一个读真实 `tauri.conf.json`
    的测试，专门盯这条。
