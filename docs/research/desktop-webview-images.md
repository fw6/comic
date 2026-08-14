# Desktop webview 图片加载架构（wayfinder #4）

Ticket: https://github.com/fw6/comic/issues/4 · 迁移背景：mobile Lynx → Tauri 桌面（macOS WKWebView / Windows WebView2 / Linux WebKitGTK）。pstatic.net 有热链保护，图片请求必须带 `Referer`（Android 现状：OkHttp interceptor 补 `https://www.webtoons.com/`，见 `sparkling-cimoc/android/app/src/main/java/com/example/sparkling/go/SparklingApplication.kt`）。

## 结论与推荐（TL;DR）

**推荐：混合方案 —— 热链保护来源（pstatic.net）走 Rust 自定义 URI scheme 代理，其余来源保持 `<img>` 直连。**

1. **三平台都无法用同一套 API 给 `<img>` 注入 Referer**：macOS 无任何公开 header 注入 API；Linux 只能通过 WebKitWebProcessExtension 的 `send-request`；仅 Windows WebView2 原生可注入。因此「webview 直连 + 原生注入」做不成跨平台主路径。
2. **Tauri 的 `register_asynchronous_uri_scheme_protocol` 是唯一三平台一致、且能完全控制请求头的路径**——macOS 走 `setURLSchemeHandler`，Windows 走 `AddWebResourceRequestedFilter`，Linux 走 `webkit_web_context_register_uri_scheme`（Tauri Builder 文档明确注明）。代理里用现有 cimoc-core 的 blocking reqwest（带 Referer）取图，可复用现有磁盘缓存。
3. **前端只需把热链保护域的图片 `src` 重写为自定义 scheme**（`cimoc-img://pstatic/<原URL>`；Windows 上为 `http://cimoc-img.localhost/<原URL>`），非保护域保持 `https://` 直连，继续享受 webview 自己的 HTTP 缓存。
4. **不要用 base64 IPC**（33% 体积膨胀）；自定义 scheme 返回二进制天然干净，IPC 兜底用 `tauri::ipc::Response` + `InvokeResponseBody::Raw(Vec<u8>)`（JS 侧 ArrayBuffer）。`tauri-plugin-http` 的 JS `fetch` 对 Referer 是 forbidden header，需 `unsafe-headers` feature，且无缓存，只作备选。
5. 图片格式：WebP 全平台 OK；AVIF 在 macOS 需 Safari 16+（16.4 覆盖 Monterey/Big Sur）、Windows WebView2 为 Chromium（Chrome 85+）、Linux 取决于发行版是否编入 libavif。超长条图需按段切片渲染（解码内存与 GPU 纹理上限约束），Webtoon 页图本就是逐页长条。

---

## 1. 各平台 webview 对 `<img>` 请求的 Referer/自定义头能力

### macOS — WKWebView：**不能注入头。**
- `WKURLSchemeHandler` 官方定义为 "A protocol for loading resources with URL schemes that **WebKit doesn't handle**" —— 只处理自定义 scheme，不能拦截 `http/https` 子资源。https://developer.apple.com/documentation/webkit/wkurlschemehandler
- `WKNavigationDelegate` 的 `decidePolicyFor` 只覆盖导航（主 frame/子 frame），不含图片等子资源加载。https://developer.apple.com/documentation/webkit/wknavigationdelegate
- Foundation 的 `URLProtocol` 作用于「URL loading system」（NSURLSession），而 WKWebView 走 WebKit 自己的网络进程——这正是 Apple 单列 `WKURLSchemeHandler` 的原因。https://developer.apple.com/documentation/foundation/urlprotocol
- `<img>` 的 Referer 由页面 referrer policy 决定，无法自定义成 `https://www.webtoons.com/`。唯一可行路径是自定义 scheme（改写图片 src），或私有 API `_WKResourceLoadDelegate`（非公开、不稳）。
- 自定义 scheme 侧：`WKURLSchemeTask` 提供 `didReceiveResponse` / `didReceiveData` / `didFinish`，支持分块流式响应。https://developer.apple.com/documentation/webkit/wkurlschemetask

### Windows — WebView2：**可以。**
- `AddWebResourceRequestedFilter` + `WebResourceRequested` 事件：文档明确按 `resourceContext` 过滤即可拿到图片请求（"the host app is only interested in WebResourceRequested events for **images** … specify the resourceContext filter for images"）。https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/webresourcerequested
- 事件在请求发出前触发："**The host app can modify headers at this point**"，之后网络栈才补 cookie/auth 等头；官方示例 `requestHeaders.SetHeader("Custom", "Value")`。https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/webresourcerequested
- `ICoreWebView2WebResourceRequest::get_Headers` 文档原文 "The **mutable** HTTP request headers"。注意事件里的请求对象可能缺网络栈稍后补的头。https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2webresourcerequest
- Tauri 内可触达原始 COM：`WebviewWindow::with_webview(|webview| webview.controller().CoreWebView2())`（Windows 下 `ICoreWebView2Controller`，Tauri 自带示例即如此用）。https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindow.html#method.with_webview

### Linux — WebKitGTK：**宿主进程不能注入头；有两条替代。**
- `webkit_web_context_register_uri_scheme`：注册自定义 scheme 回调，可异步 `webkit_uri_scheme_request_finish()` / `finish_error()`；实现层明确拒绝注册特殊 scheme（含 http/https/ftp/file/ws/wss，报 "Registering special URI scheme … is no longer allowed"）。https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/API/glib/WebKitWebContext.cpp
- `WebKitWebView::resource-load-started` 只是监控信号（只读 request）。https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/API/glib/WebKitWebView.cpp
- **可注入头的唯一官方机制**是 Web 进程扩展里的 `WebKitWebPage::send-request` 信号："This signal is emitted when @request is about to be sent to the server. This signal can be used to **modify the WebKitURIRequest** … Modifications to the WebKitURIRequest and its associated **SoupMessageHeaders will be taken into account** when the request is sent over the network." 需用 `webkit_web_context_set_web_process_extensions_directory` 加载扩展。https://github.com/WebKit/WebKit/blob/main/Source/WebKit/WebProcess/InjectedBundle/API/glib/WebKitWebPage.cpp

### 平台结论
| 平台 | `<img>` 注入 Referer | 最简可行方案 |
|---|---|---|
| macOS WKWebView | 不可（公开 API 无） | 自定义 scheme 代理 |
| Windows WebView2 | 可（WebResourceRequested，需原生 COM 代码） | 原生注入，或统一走 scheme 代理 |
| Linux WebKitGTK | 需 WebProcessExtension（重） | 自定义 scheme 代理 |

## 2. Rust 代理可行性（reqwest + Referer 流回前端）

- **Tauri 原生支持自定义 scheme 代理**：`Builder::register_uri_scheme_protocol` / `register_asynchronous_uri_scheme_protocol`，后者带 `UriSchemeResponder`，"allows you to process the request in a **separate thread** and respond asynchronously" —— blocking reqwest 调用放进 worker 线程即可，不阻塞主线程。https://docs.rs/tauri/latest/tauri/struct.Builder.html#method.register_asynchronous_uri_scheme_protocol
- 平台 scheme 形态：macOS/Linux 为 `my-scheme://localhost/<path>`；Windows（及 Android）为 `http://my-scheme.localhost/<path>`。https://docs.rs/tauri/latest/tauri/struct.Builder.html#method.register_uri_scheme_protocol
- 处理函数签名 `Fn(&str, http::Request<Vec<u8>>) -> http::Response<T>`，响应体为单块 `Cow<'static,[u8]>`；图片体积有界（每页数 MB），单块返回可行；超大图不追求流式。同上链接。
- **二进制 IPC 而非 base64**：`tauri::ipc::Response` + `InvokeResponseBody::Raw(Vec<u8>)`（"Bytes payload"），JS 侧收 ArrayBuffer，再 `URL.createObjectURL` 喂给 `<img>`。https://docs.rs/tauri/latest/tauri/ipc/enum.InvokeResponseBody.html
- **流式备选**：官方 Channels 机制（`tauri::ipc::Channel<&[u8]>`，文档示例即「流式 HTTP 响应」），适合分块喂长图。https://v2.tauri.app/develop/calling-rust/（Channels 一节）
- **HTTP 缓存语义**：自定义 scheme 响应不经过 webview 的 HTTP 缓存，命中/过期语义要由 Rust 侧自己实现——正好复用 cimoc-core 现有 `download_image`（按 `dir/<comicId>/chapter_<n>/<page>.<ext>` 落盘，见 `sparkling-cimoc-bridge/rust/src/native/files.rs`）与 blocking `http::get_bytes`。读多写少：加一层按 URL 的 LRU 内存缓存即可。
- `tauri-plugin-http`（JS fetch）：Referer 属 Fetch 规范 forbidden header，默认被忽略，须开 `unsafe-headers` feature；且该路径无 webview 缓存、需手动管理 blob 生命周期。可作备选，不作主方案。https://v2.tauri.app/plugin/http-client/

## 3. 图片格式支持（WebP / AVIF / 超长图）

- **WebP**：Safari 14（2020-09）起支持（"Added WebP image support"，Apple Safari 14 Release Notes）。https://developer.apple.com/documentation/safari-release-notes/safari-14-release-notes ｜ Chromium（含 WebView2）Chrome 32+。https://github.com/Fyrd/caniuse/blob/main/features-json/webp.json ｜ WebKitGTK 随 libwebp 默认编入（gtk NEWS："Add support for image/webp to canvas.toDataURL()"）。https://github.com/WebKit/WebKit/blob/main/Source/WebKit/gtk/NEWS
- **AVIF**：Safari 16（macOS Ventura）支持，Safari 16.4 扩展到 Monterey/Big Sur（"Last fall, Safari 16 brought support for AVIF … Now with Safari 16.4, AVIF is also supported on macOS Monterey and macOS Big Sur"）。https://webkit.org/blog/13966/webkit-features-in-safari-16-4/ ｜ Chromium Chrome 85+。https://github.com/Fyrd/caniuse/blob/main/features-json/avif.json ｜ WebKitGTK 解码器以 `#if USE(AVIF)` 条件编译，依赖构建时 libavif，能力随发行版而异。https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/image-decoders/avif/AVIFImageDecoder.cpp
- **超长条图**：`<img>` 无文档化尺寸硬上限，瓶颈在解码内存（长条解码为 RGBA 约 4 字节/像素）与 GPU 纹理上限（各引擎典型 16k px 级），超长图在合成/滚动路径有退化或崩溃风险（WebKitGTK NEWS 甚至有 "Fix a WebProcess crash when loading large contents with custom URI schemes API"）。webtoon 读者惯例是逐段切片渲染；本项目 Lynx 端 `Reader.tsx` 的 `PageImage` 即逐页 `<image src={CDN URL}>`，若单页条图超高，桌面端需同样按段切片或缩档。https://github.com/WebKit/WebKit/blob/main/Source/WebKit/gtk/NEWS

## 4. 缓存与长滚动内存

- **macOS**：`WKWebsiteDataStore` 管理 "cookies, **disk and memory caches**"，但只对 webview 自己发出的请求生效——自定义 scheme 响应不落它的缓存。https://developer.apple.com/documentation/webkit/wkwebsitedatastore
- **Windows**：WebView2 User Data Folder 内含 `DiskCache` 等（`CoreWebView2BrowsingDataKinds`），即 Chromium HTTP 磁盘缓存；同样只覆盖直连请求。https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder
- **Linux**：WebKitGTK 网络进程侧磁盘缓存（WebsiteDataManager/NetworkSession）。
- **Rust 侧的角色**：桌面端把缓存收敛到 Rust（磁盘 + LRU），直连来源仍用 webview 缓存。`download_image`/`list_downloaded`/`scan_local` 已具备按漫画/章节分层的文件缓存，代理路径可直接复用并加内存 LRU；下载器（offline 下载）天然共享同一套取图逻辑。

## Sources

- Apple WKURLSchemeHandler / WKURLSchemeTask / WKNavigationDelegate / URLProtocol / WKWebsiteDataStore / Safari 14 Release Notes —— developer.apple.com / webkit.org 官方文档（见上文内链）
- WebKit 源码（main 分支）：`Source/WebKit/UIProcess/API/glib/WebKitWebContext.cpp`、`WebKitWebView.cpp`、`WebProcess/InjectedBundle/API/glib/WebKitWebPage.cpp`、`Source/WebCore/platform/image-decoders/avif/AVIFImageDecoder.cpp`、`Source/WebKit/gtk/NEWS`
- Microsoft Learn：`/microsoft-edge/webview2/how-to/webresourcerequested`、Win32 reference `icorewebview2webresourcerequest`、`/concepts/user-data-folder`
- Tauri：docs.rs `tauri::Builder`、`tauri::ipc::Response`/`InvokeResponseBody`、`tauri::WebviewWindow::with_webview`、v2.tauri.app/develop/calling-rust、v2.tauri.app/plugin/http-client、Tauri 源码 `crates/tauri-runtime-wry`（`controller.CoreWebView2()` 用法同款）
- caniuse 数据文件：`features-json/webp.json`、`features-json/avif.json`
- 本仓库：`sparkling-cimoc/android/.../SparklingApplication.kt`（OkHttp Referer 现状）、`sparkling-cimoc-bridge/rust/src/native/files.rs`（download_image/缓存）、`sparkling-cimoc/src/cimoc/screens/Reader.tsx`（逐页 `<image>`）
