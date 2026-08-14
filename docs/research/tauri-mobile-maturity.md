# Tauri Mobile（iOS/Android）成熟度调研

- Ticket: https://github.com/fw6/comic/issues/3
- 调研日期：2026-08-14。所有结论基于官方文档与第一方仓库，非二手资料。

## 结论速览与建议

**Tauri Mobile 已是 GA（stable），不是 beta/alpha。** v2.0 稳定版（2024-10-02）即含 iOS/Android 支持；当前 v2.11.5（2026-07-01）仍在活跃发布，官方文档已把移动端作为一等公民（不再有 beta/实验性标注）。但官方自评**移动端 DX 仍低于桌面端**，且对本 App（漫画阅读器）存在三个具体能力缺口：**FCM 推送、后台下载/任务、移动端自动更新**。

**建议（按顺序）：**

1. **桌面 v1 现在就为移动端预留接口（成本极低，必做）。** 从建仓第一天就采用 v2 官方"移动就绪"crate 布局：`src-tauri/src/lib.rs` 共享入口 + `#[cfg_attr(mobile, tauri::mobile_entry_point)]` + 薄 `main.rs`；Rust 核心保持平台无关。这是官方文档给出的标准形态，不是额外设计。
2. **移动里程碑现在就可以规划，但排期放在桌面 v1 之后。** 移动端已可用、缺口的边界是已知且可控的；不需要"等 Tauri 移动端成熟"。
3. **移动里程碑第 1 周先做去风险 spike**：真机上跑通最小 `tauri android dev` / `tauri ios dev`，用图片密集列表验证 WKWebView/Android WebView 实际行为——这是本 App 最大的技术未知项，应在起点而非终点验证。随后排期补自研插件（FCM、后台下载）。

---

## Q1. Tauri Mobile 当前状态

- **GA 而非 beta**：Tauri 2.0 稳定版发布于 2024-10-02，移动支持随稳定版一起发布，官方表述为"现在扩展到 iOS 和 Android"。来源：https://v2.tauri.app/blog/tauri-20/
- 官方自评："**We are not completely happy about the developer experience at the moment** but are actively improving to bring it up to par with the desktop experience."（当前移动端 DX 尚未达到桌面端水准，正在追赶）。来源：同上。
- **文档已是一等公民**：移动开发指南是标准文档的固定章节（/develop/ 下 "Developing Your Mobile Application"），前置条件在 /start/prerequisites/（"Configure for Mobile Targets"）。旧链接 `/start/mobile/` 与 `/roadmap/` 是文档改版后被移除的（现 404），并非移动端降级。来源：https://v2.tauri.app/develop/ 、 https://v2.tauri.app/start/prerequisites/
- 全量文档中移动相关章节均**无 beta/experimental 标注**（grep 验证）。来源：https://v2.tauri.app/llms-full.txt
- **活跃维护**：v2.11.5 stable（2026-07-01），近半年约每月 1–2 个 minor。来源：https://github.com/tauri-apps/tauri/releases
- **下一大版本 v3.0**：milestone 已开（12 个 issue），内容为重构（Linux GTK4/WebKitGTK6 迁移、ACL 权限系统重构等），**不是移动端大改**。来源：https://github.com/tauri-apps/tauri/milestones

## Q2. 对图片密集型 WebView 应用的限制

- **渲染引擎**：wry 在各平台用系统 WebView——iOS 用 WKWebView（`wry/src/wkwebview/ios/`），Android 用系统 WebView（`wry/src/android/.../RustWebView.kt`）。来源：https://github.com/tauri-apps/wry
- **图片密集的风险**：WKWebView 将 Web 内容跑在独立进程中，移动端内存压力下有进程被杀/崩溃的社区报告（如 #7407 "the webview crashes on release target"）。来源：https://developer.apple.com/documentation/webkit/wkwebview 、 https://github.com/tauri-apps/tauri/issues/7407
- **移动端 webview 未竟事项（tauri 仓库 open issues）**：移动端不支持多 webview（#11528、#10986）；`add_child(webview)` 不支持移动端（#11794）；async 入口在移动端有问题（#12513、#10942）；iOS WKWebView 从后台返回后宽度错乱（#15367）。来源：https://github.com/tauri-apps/tauri/issues
- **后台下载/网络任务：无第一方能力**。iOS 后台应用会被系统挂起（Apple "Background Execution"），Android 需要前台服务/WorkManager（Android 官方 FGS 文档）。Tauri 无官方前台服务/后台任务插件；且社区反馈该组合有 bug（#15671：前台服务运行中重拉任务后 webview 空白）。来源：https://developer.apple.com/library/archive/documentation/iPhone/Conceptual/iPhoneOSProgrammingGuide/BackgroundExecution/BackgroundExecution.html 、 https://developer.android.com/develop/background-work/services/fgs 、 https://github.com/tauri-apps/tauri/issues/15671
- **推送通知：只有本地通知，无 FCM**。tauri-plugin-notification 在 iOS/Android 支持本地通知（README 平台表 ✓✓），但 Android 工程**无任何 Firebase 依赖**（build.gradle.kts 验证），设备 token/推送注册请求 plugins-workspace#1698 已关闭且未实现；tauri#11651 "Push Notifications" 仍 open。来源：https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/notification 、 https://github.com/tauri-apps/plugins-workspace/issues/1698 、 https://github.com/tauri-apps/tauri/issues/11651
- **自动更新不支持移动端**：tauri-plugin-updater 平台表 Android ✗ / iOS ✗，移动端更新只能走应用商店。来源：https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/updater
- **官方插件移动端覆盖（plugins-workspace v2 分支逐目录验证）**：
  - 支持 iOS+Android：notification、http、fs、upload、websocket、deep-link、dialog、shell、opener、geolocation、biometric、clipboard-manager、nfc、haptics（http/fs/upload/websocket 的 README 平台表均为 ✓✓）。
  - 不支持移动端：updater、autostart、cli、global-shortcut、localhost、os、persisted-scope、positioner、process、single-instance、sql、store、stronghold、window-state。
  - 来源：https://github.com/tauri-apps/plugins-workspace/tree/v2
- 本 App 需要的网络/文件插件（http、fs）移动端可用；**缺口集中在后台下载、FCM 推送、更新**三类，均需自研 Kotlin/Swift 插件（官方 "Mobile Plugin Development" 指南即为该模式）。来源：https://v2.tauri.app/develop/plugins/develop-mobile/

## Q3. 通往移动里程碑的最短路径

- **前置条件**：Android 需 Android Studio + JDK（JAVA_HOME）、Android SDK/NDK/Build-Tools + rustup 目标（aarch64/armv7/i686/x86_64-linux-android）；iOS 仅 macOS，需 Xcode + Cocoapods + rustup 目标（aarch64-apple-ios、x86_64-apple-ios、aarch64-apple-ios-sim）。来源：https://v2.tauri.app/start/prerequisites/
- **改造现有桌面工程为移动就绪**：Cargo.toml 加 `[lib] crate-type = ["staticlib", "cdylib", "rlib"]`，逻辑移入共享 `lib.rs` + `#[cfg_attr(mobile, tauri::mobile_entry_point)]`，`main.rs` 变薄壳。官方文档 "Preparing for Mobile" 节。来源：https://v2.tauri.app/start/migrate/from-tauri-1/
- **init/dev/build**：`tauri android init|dev|build`、`tauri ios init|dev|build`（iOS 命令仅 macOS）；`android build --aab|--apk`（Play 商店 AAB 上架、含版本号/签名/16KB 页对齐要求），`ios build` 出 IPA；首次构建 Rust 依赖需数分钟。来源：https://v2.tauri.app/reference/cli/ 、 https://v2.tauri.app/distribute/
- **分发**：官方有 App Store 与 Google Play 完整指南及 Android/iOS 签名文档。来源：https://v2.tauri.app/distribute/app-store/ 、 https://v2.tauri.app/distribute/google-play/ 、 https://v2.tauri.app/distribute/sign/ios/
- **CI 差距**：tauri-action 的 iOS/Android 构建标记为 **EXPERIMENTAL**。来源：https://github.com/tauri-apps/tauri-action

## Q4. 推荐

- **不要等**。移动端已 GA、文档成熟、发布活跃；对本 App 的缺口是"已知且可边界化"的，不是"未知的成熟度风险"。
- **桌面 v1 预留移动端接口**：采用官方"移动就绪"crate 布局 + 平台无关的 Rust 核心（当前 repo 已把爬虫/下载/WebDAV 下沉 Rust，与 Tauri 双端共享 Rust 核心的模型天然契合）。代价近乎为零，直接解锁移动里程碑。
- **移动里程碑排桌面 v1 之后**，且以"第 1 周真机 spike"开局验证 webview 图片行为；为 FCM 推送、后台下载、无自动更新这三块预留在进度里约 2–4 周的自研原生插件工作量。

## Sources

- Tauri v2.0 稳定版公告（含移动端 GA 声明与 DX 自评）：https://v2.tauri.app/blog/tauri-20/
- 移动开发指南：https://v2.tauri.app/develop/ ；移动前置条件：https://v2.tauri.app/start/prerequisites/ ；"Preparing for Mobile"：https://v2.tauri.app/start/migrate/from-tauri-1/
- CLI 参考（android/ios init·dev·build）：https://v2.tauri.app/reference/cli/
- 分发/App Store/Google Play/签名：https://v2.tauri.app/distribute/ 及其子页
- 全量文档文本：https://v2.tauri.app/llms-full.txt ；guides 文本：https://v2.tauri.app/_llms-txt/guides.txt
- tauri 仓库（releases、milestones、issues）：https://github.com/tauri-apps/tauri
- 官方插件仓库（移动覆盖逐目录验证、notification/updater/http 等 README）：https://github.com/tauri-apps/plugins-workspace/tree/v2
- wry 渲染引擎（iOS=WKWebView、Android=系统 WebView 源码）：https://github.com/tauri-apps/wry
- tauri-action（移动构建 EXPERIMENTAL）：https://github.com/tauri-apps/tauri-action
- Apple WKWebView：https://developer.apple.com/documentation/webkit/wkwebview ；Apple 后台执行：https://developer.apple.com/library/archive/documentation/iPhone/Conceptual/iPhoneOSProgrammingGuide/BackgroundExecution/BackgroundExecution.html
- Android 前台服务：https://developer.android.com/develop/background-work/services/fgs
