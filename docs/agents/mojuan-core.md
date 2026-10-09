# Rust 核心 mojuan-core 约定

## 位置与职责

- `desktop/crates/mojuan-core/` — 跨端共享的爬虫引擎与 WebDAV/下载/本地文件 IO/图片缓存（`cache::fetch_image`）。
- `src-tauri` 经 tauri command 接线；核心本身无绑定层、不重写。

## 爬虫解析：运行时源脚本（2026-08-15 起）

- 解析与 URL 构造由**运行时源脚本**完成：`src/js/sources/`，rquickjs 0.12.2 执行。
- 契约：`buildUrl(op,payload,ctx)` / `parse(op,input,ctx)` → JSON 字符串（见 `src/js/mod.rs`）。
- Rust 侧保留网络/请求头/缓存（webtoons series URL、mangadex tags/章节 id、copymanga 章节 uuid、dongman viewer URL、manhuagui 仅请求头）与命令层。

## 渲染源（隐藏 webview 通道，2026-09-30 起）

- **JS 挑战 / 客户端环境校验型防护的源**（当前 baozimh、nnhanman）整源改经隐藏 webview 渲染通道取页面：
  `crawler/render.rs` 的 `needed(source)` 声明、`script.rs::fetch` 分流、宿主经 `render::set_fetcher`
  注册实现（桌面 = src-tauri 的隐藏窗口，移动 = `tauri-plugin-mojuan-render` 的离屏 webview）；取回的
  渲染后 HTML 走与普通抓取相同的 parse 契约。
- 判据的唯一定义处也在 `crawler/render.rs`：`STATE_SCRIPT`（页面状态脚本）、`HTML_SCRIPT`、
  `is_clean` / `is_denied`、`POLL_INTERVAL`、`RENDER_TIMEOUT`；桌面宿主与移动端原生侧共用，挑战页
  形态变化只改这里（测试用 QuickJS + 页面桩覆盖各形态）。
- 未注册宿主（mojuan-core 单独跑测试）时 `fetch` 返回「渲染通道未注册」错误，由 `record_error`
  呈现；`cargo test` 不依赖 webview。
- baozimh 的章节中转链 URL 经 detail 解析的隐藏字段 `pageUrl` + `script::post_process` 入
  `crawler/baozimh.rs` 进程内缓存（同 webtoons seriesUrl / dongman viewerUrl 形状），images 的
  `build_ctx` 从缓存取；缓存未命中按空结果返回。
- 真网验证用 `src-tauri/examples/render_probe.rs`（dump / crawl / chain 三种模式），设计细节与
  踩坑见 `docs/research/webview-render-channel.md`。

## 结果缓存（stale-while-revalidate，2026-10-08 起）

- `crawler/result_cache.rs`：列表/详情类 op（`categories | category | search | detail`）的**成功**
  结果缓存——内存 LRU + 磁盘 `<appCacheDir>/results/<sha256>.json`；`images` 不缓存（地址可能带
  时效参数），cache_dump/cache_hydrate 是缓存管理 op 本身。
- 缓存键 = (source, op, 规范化 payload, 脚本) 的 sha256：payload 解析后按 serde_json 默认
  键序重排（同对象不同键序命中同一条），脚本变化即自然失效。
- 接线在 `crawler::crawl`：`script::run` 返回 `(结果, 是否成功)`，失败（含空 URL）不写入；
  `cache_dir` 参数为空串表示禁用缓存（测试与 render_probe 用）。
- 读取入口 `mojuan_core::cached_result`（命令 `crawl_cached`）：命中返回
  `{"data": ..., "fetchedAt": ms}` 并清除该源陈旧错误行，未命中返回 `null`。
- 条目保留期 7 天（src-tauri setup 启动时 `result_cache::prune` 清理）；新鲜度判定在前端
  （`fetchedAt` 与本地时钟比较），Rust 侧不设 TTL。

## 命令 API 约定

- 公开函数接收 `&str`、返回 JSON 字符串，无 uniffi 包装。
- 命令层直接传 `&s` 或 `s.as_str()`，不要建 String 参数签名。

## 开发工作流与测试

- 改 Rust 核心：workspace 内直接编译，改完跑 `cargo test`（解析器有 fixture 测试）。
- 源码：直接读 `desktop/crates/mojuan-core/src/`（js/crawler/native/cache 模块），API 为 `&str` → JSON 字符串。
