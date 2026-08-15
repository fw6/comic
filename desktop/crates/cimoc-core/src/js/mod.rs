//! 源脚本执行层 —— 契约原型（wayfinder #15，评审定案后随迁移演化）。
//!
//! 契约：每个源脚本导出全局函数 `parse(op, input, ctx)`：
//! - `op`：`categories | search | category | detail | images`（与 `crawler/mod.rs` 的 crawl op 对齐）
//! - `input`：Rust 层抓取的原始响应体（HTML 或 JSON 字符串）
//! - `ctx`：JSON 字符串，op 相关上下文（如 detail 的 `{"comicId": "demo:1"}`）
//! - 返回：JSON 字符串（categories → `["…"]`；search/category → `[{Comic}]`；
//!   detail → `{comic, chapters}`；images → `["url", …]`），与现 crawl 协议一致
//! - 出错：脚本 `throw`，本层把错误消息与堆栈转为 `Err`
//!
//! 限制（research #13/#14 定案，含 #14 修订）：每次调用新建 Runtime（用完即弃，创建 <300µs）；
//! 内存上限 32MB；墙钟超时 2s（interrupt handler）；栈默认 256KiB；脚本 ≤ 256KB（Rust 侧检查）。
//! 线程模型：本层无内部线程、无跨调用状态，调用方在 blocking 线程内使用
//! （src-tauri 的 `spawn_blocking`），天然并发安全。
//! rquickjs 0.12.2 默认 features；勿开 `rust-alloc`（令 `set_memory_limit` 失效）。
//! 全局白名单挂 Date/Json/Eval（research #14 修订：Eval intrinsic 必须挂——引擎执行脚本本身
//! 走 `eval_internal`，`custom` 缺 Eval 时连脚本都加载不了，全局 eval/Function 无法分离禁用，
//! DoS 兜底靠超时/内存/脚本体积；RegExp/MapSet 未挂，脚本用字符串方法）。

use rquickjs::context::intrinsic::{Date, Eval, Json};
use rquickjs::{CaughtError, CatchResultExt, Context, Function, Runtime};
use std::time::{Duration, Instant};

/// 脚本体积上限（字节）。
const MAX_SCRIPT_BYTES: usize = 256 * 1024;
/// 单次解析墙钟超时。
const TIMEOUT: Duration = Duration::from_secs(2);
/// 引擎内存上限（字节）。
const MEMORY_LIMIT: usize = 32 * 1024 * 1024;

/// 调源脚本 `parse(op, input, ctx)`，成功返回 JSON 字符串。
pub fn call(script: &str, op: &str, input: &str, ctx: &str) -> Result<String, String> {
    if script.len() > MAX_SCRIPT_BYTES {
        return Err("脚本超过 256KB 上限".to_string());
    }
    let runtime = Runtime::new().map_err(|e| e.to_string())?;
    runtime.set_memory_limit(MEMORY_LIMIT);
    let deadline = Instant::now() + TIMEOUT;
    runtime.set_interrupt_handler(Some(Box::new(move || Instant::now() >= deadline)));

    let context = Context::custom::<(Date, Json, Eval)>(&runtime).map_err(|e| e.to_string())?;
    context.with(|c| {
        // 先编译并执行脚本（语法错误/顶层 throw 在这里报出，含行号堆栈）。
        c.eval::<(), _>(script).catch(&c).map_err(caught_error)?;
        let f: Function = c.globals().get("parse").map_err(|e| e.to_string())?;
        f.call::<_, String>((op, input, ctx))
            .catch(&c)
            .map_err(caught_error)
    })
}

/// 把 JS 侧错误转为带消息与堆栈的字符串。
fn caught_error(c: CaughtError) -> String {
    match c {
        CaughtError::Exception(e) => format!(
            "{} @ {}",
            e.message().unwrap_or_default(),
            e.stack().unwrap_or_default()
        ),
        CaughtError::Value(v) => format!("脚本抛出非 Error 值: {v:?}"),
        CaughtError::Error(e) => e.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const DEMO: &str = include_str!("demo_source.js");

    const LIST_HTML: &str = r#"
        <div class="item" data-title="海贼王" data-author="尾田荣一郎" data-cover="https://img.example.com/1.webp"></div>
        <div class="item" data-title="电锯人" data-author="藤本树" data-cover="https://img.example.com/2.webp"></div>
    "#;

    #[test]
    fn demo_search_parses_list_html() {
        let json = call(DEMO, "search", LIST_HTML, "{}").expect("search 应成功");
        let comics: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(comics[0]["title"], "海贼王");
        assert_eq!(comics[0]["id"], "demo:海贼王");
        assert_eq!(comics[1]["author"], "藤本树");
        assert_eq!(comics[1]["source"], "demo");
    }

    #[test]
    fn demo_category_and_detail() {
        let cats = call(DEMO, "categories", "", "{}").expect("categories 应成功");
        assert!(cats.contains("悬疑"));

        let html = r#"<h1 class="title">海贼王</h1><div class="ep" data-index="1">第 1 话</div><div class="ep" data-index="2">第 2 话</div>"#;
        let json = call(DEMO, "detail", html, r#"{"comicId":"demo:海贼王"}"#).expect("detail 应成功");
        let detail: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(detail["comic"]["title"], "海贼王");
        assert_eq!(detail["comic"]["id"], "demo:海贼王");
        assert_eq!(detail["chapters"][1]["index"], 2.0);
        assert_eq!(detail["chapters"][1]["title"], "第 2 话");
    }

    #[test]
    fn demo_images_parses_img_tags() {
        let html = r#"<img src="https://img.example.com/1.webp"><img src="https://img.example.com/2.webp">"#;
        let json = call(DEMO, "images", html, "{}").expect("images 应成功");
        let urls: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(urls.as_array().unwrap().len(), 2);
    }

    #[test]
    fn throw_surfaces_as_err_with_message() {
        let err = call(DEMO, "bogus", "", "{}").unwrap_err();
        assert!(err.contains("未知 op"), "err = {err}");
    }

    #[test]
    fn script_syntax_error_reports_line() {
        let broken = "function parse( { return 1 }";
        let err = call(broken, "search", "", "{}").unwrap_err();
        assert!(!err.is_empty(), "语法错误应报出消息/堆栈");
    }

    #[test]
    fn infinite_loop_interrupted_by_timeout() {
        let evil = "function parse() { while (true) {} }";
        let started = Instant::now();
        let err = call(evil, "search", "", "{}").unwrap_err();
        assert!(started.elapsed() < TIMEOUT * 3, "应被 {TIMEOUT:?} 超时打断");
        assert!(!err.is_empty());
    }

    #[test]
    fn oversized_script_rejected() {
        let big = "x".repeat(MAX_SCRIPT_BYTES + 1);
        assert!(call(&big, "search", "", "{}").is_err());
    }
}
