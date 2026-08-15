# AGENTS.md

You are an expert in Rust, TypeScript/React, and Tauri v2 application development. You write maintainable, performant, and accessible code.

## Repository Layout

- `desktop/` — **当前主工程**：Cimoc 漫画阅读器桌面版（macOS/Windows/Linux），Tauri v2 + React（Vite web 前端）。前端在 `desktop/src/`，Rust 后端在 `desktop/src-tauri/`。
- `desktop/crates/cimoc-core/` — **Rust 核心**：跨端共享的爬虫引擎与 WebDAV/下载/本地文件 IO/图片缓存（`cache::fetch_image`）。爬虫解析与 URL 构造自 2026-08-15 起为**运行时源脚本**（`src/js/sources/`，rquickjs 0.12.2 执行，契约 `buildUrl(op,payload,ctx)`/`parse(op,input,ctx)` → JSON 字符串，见 `src/js/mod.rs`）；Rust 侧保留网络/请求头/缓存（webtoons series URL、mangadex tags/章节 id）与命令层。`src-tauri` 经 tauri command 接线，核心本身无绑定层、不重写。
- `docs/` — wayfinder 决策地图（GitHub Issues）、研究纪要（`docs/research/`）、issue 追踪约定（`docs/agents/issue-tracker.md`）。
- `CONTEXT.md` — 领域术语表（无限滚动、外链章节过滤、进度自动记录等，grilling #6 定案）。
- 旧 Lynx 工程（`sparkling-cimoc/`、根 `src/ android/ dist/`）已删除（big-bang，轨迹见 wayfinder 地图「从 Lynx 迁移到 Tauri」: https://github.com/fw6/comic/issues/2）。

## Read in Advance

- Tauri: [llms.txt](https://tauri.app/llms.txt)，**REQUIRED**。处理 Tauri 任务前必须阅读（文档入口）。
- Tauri 插件: <https://tauri.app/plugin/>（store/dialog/opener/fs 等）。
- Rust 核心：直接读 `desktop/crates/cimoc-core/src/` 源码（js/crawler/native/cache 模块），API 为 `&str` → JSON 字符串；源脚本契约与内置脚本见 `src/js/`。

## Commands

桌面工程（在 `desktop/` 下执行）：

- `npm run tauri dev` - 开发模式（Vite HMR；改 Rust 触发后端重编，比前端慢）
- `npm run tauri build` - 打包桌面应用
- `npm run build` - 前端构建（`tsc && vite build`）
- `npx tsc --noEmit` - 仅类型检查
- `cargo test` / `cargo check` - Rust workspace（cimoc-core + src-tauri）

## Development Workflow

- 改前端（`desktop/src/`）：`npm run tauri dev` 热更新。
- 改 Rust 核心（`desktop/crates/cimoc-core/`）：workspace 内直接编译，改完跑 `cargo test`（解析器有 fixture 测试）。
- 图片加载：热链域（Webtoons pstatic.net）必须走 `cimoc-img://` 自定义 scheme 代理（Rust 加 Referer + 磁盘缓存/LRU）；其余域 `<img>` 直连吃 webview HTTP 缓存。macOS/Linux 无法给 `<img>` 注入 Referer，只能走代理。见 `docs/research/desktop-webview-images.md`。

## Known Gotchas（坑）

1. **Tauri 同步命令在主线程执行**：阻塞式 reqwest 必须放 async 命令 + `tauri::async_runtime::spawn_blocking`，否则冻结 UI。
2. **自定义 scheme 回调（cimoc-img://）**：macOS WKURLSchemeHandler 回调跑在主线程，同样需要 spawn_blocking。
3. **`withGlobalTauri` 必须放 `tauri.conf.json` 的 `app` 段**（不在 `security` 段；`app.withGlobalTauri: true`）。
4. **cargo 源**：本仓库 `.cargo/config.toml` 将 crates-io 重定向到 rsproxy.cn（用户要求：不用内网 artifactory；官方源 403 时用国内镜像）。不要改动。
5. **workspace 构建产物**：`desktop/target/` 由 workspace 根生成，成员 crate 的 `/target` 忽略规则覆盖不到——`desktop/.gitignore` 必须包含 `target`。
6. **cimoc-core 命令 API**：公开函数接收 `&str`、返回 JSON 字符串，无 uniffi 包装；命令层直接传 `&s` 或 `s.as_str()`，不要建 String 参数签名。

## Related Docs

- Tauri: <https://tauri.app/llms.txt>
- Tauri 插件（store/dialog/opener/fs）: <https://tauri.app/plugin/>
- Vite: <https://vite.dev/>
- wayfinder 地图: <https://github.com/fw6/comic/issues/2>
