# Rust 核心 cimoc-core 约定

## 位置与职责

- `desktop/crates/cimoc-core/` — 跨端共享的爬虫引擎与 WebDAV/下载/本地文件 IO/图片缓存（`cache::fetch_image`）。
- `src-tauri` 经 tauri command 接线；核心本身无绑定层、不重写。

## 爬虫解析：运行时源脚本（2026-08-15 起）

- 解析与 URL 构造由**运行时源脚本**完成：`src/js/sources/`，rquickjs 0.12.2 执行。
- 契约：`buildUrl(op,payload,ctx)` / `parse(op,input,ctx)` → JSON 字符串（见 `src/js/mod.rs`）。
- Rust 侧保留网络/请求头/缓存（webtoons series URL、mangadex tags/章节 id）与命令层。

## 命令 API 约定

- 公开函数接收 `&str`、返回 JSON 字符串，无 uniffi 包装。
- 命令层直接传 `&s` 或 `s.as_str()`，不要建 String 参数签名。

## 开发工作流与测试

- 改 Rust 核心：workspace 内直接编译，改完跑 `cargo test`（解析器有 fixture 测试）。
- 源码：直接读 `desktop/crates/cimoc-core/src/`（js/crawler/native/cache 模块），API 为 `&str` → JSON 字符串。
