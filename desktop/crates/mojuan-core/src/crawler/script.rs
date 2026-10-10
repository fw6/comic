//! 脚本源执行器：buildUrl → 抓取 → parse → 后处理。
//!
//! 网络/请求头/缓存驻留 Rust（grilling #11）：脚本只负责 URL 构造与解析；Rust 侧经 ctx
//! 提供缓存派生值。每个源的知识（请求头、ctx 派生、隐藏字段提取、渲染通道声明）在
//! `crawler/sources/` 的 adapter 里，本模块只跑流程。

use crate::crawler::{http, render, sources::Source};
use serde_json::Value;

/// 跑一个脚本源 op：buildUrl →（抓取）→ parse → 后处理。失败按协议返回空 JSON 并记录错误。
/// 第二个返回值 = 本次是否成功（供结果缓存判定，见 `crawler::crawl`）。
pub fn run(src: &dyn Source, op: &str, payload: &str, script: &str) -> (String, bool) {
    let payload_val: Value = serde_json::from_str(payload).unwrap_or(Value::Null);
    let ctx_val = src.ctx(op, &payload_val);
    let ctx = ctx_val.to_string();
    let url = match crate::js::call(script, "buildUrl", op, payload, &ctx) {
        Ok(u) => u,
        Err(e) => {
            src.errors().record(&format!("buildUrl({op}): {e}"));
            return (empty_for(op), false);
        }
    };
    // categories 无 URL：脚本静态输出，跳过抓取；其余 op 空 URL = 无可抓取（按空结果返回）。
    let input = if url.is_empty() && op == "categories" {
        String::new()
    } else if url.is_empty() {
        return (empty_for(op), false);
    } else {
        match fetch(src, op, &url, &ctx_val) {
            Ok(s) => s,
            Err(e) => {
                src.errors().record(&format!("fetch({op}): {e}"));
                return (empty_for(op), false);
            }
        }
    };
    match crate::js::call(script, "parse", op, &input, &ctx) {
        Ok(json) => {
            let out = src.post_process(op, &json);
            src.errors().clear();
            (out, true)
        }
        Err(e) => {
            src.errors().record(&format!("parse({op}): {e}"));
            (empty_for(op), false)
        }
    }
}

/// 抓取原始响应体（HTML 或 JSON 文本）；请求头按 adapter 给（图片 op 带 Referer）。
/// 声明了渲染通道的源整源改经隐藏 webview 取渲染页。
fn fetch(src: &dyn Source, op: &str, url: &str, ctx: &Value) -> Result<String, String> {
    if src.render_channel() {
        return render::fetch(url);
    }
    let headers = src.headers(op, ctx);
    let borrowed: Vec<(&str, &str)> = headers.iter().map(|(k, v)| (*k, v.as_str())).collect();
    http::get_text(url, &borrowed)
}

/// 失败时的空结果：detail 是对象，其余 op 是列表。
fn empty_for(op: &str) -> String {
    if op == "detail" {
        "{}".into()
    } else {
        "[]".into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crawler::sources;

    /// 脚本抛错时按协议返回空结果并记下该源的错误；成功时清掉。
    #[test]
    fn script_errors_are_recorded_per_source() {
        let broken = "function buildUrl() { throw new Error('boom') }";
        let src = sources::get("hentara").unwrap();
        let (out, ok) = run(src, "search", "{}", broken);
        assert_eq!(out, "[]");
        assert!(!ok);
        let (msg, _) = src.errors().get().expect("应记录错误");
        assert!(msg.contains("boom"), "msg = {msg}");
        assert!(msg.starts_with("buildUrl(search)"), "msg = {msg}");

        // detail 失败给对象形态的空结果
        let (out, ok) = run(src, "detail", "{}", broken);
        assert_eq!(out, "{}");
        assert!(!ok);
    }

    /// buildUrl 返回空 URL 的非 categories op：不抓取、不算成功、不记错误。
    #[test]
    fn empty_url_is_an_empty_result() {
        let script = "function buildUrl(op, payload, ctx) { return '' } \
                      function parse() { return '[]' }";
        let src = sources::get("hentara").unwrap();
        src.errors().record("陈旧错误");
        let (out, ok) = run(src, "images", "{}", script);
        assert_eq!(out, "[]");
        assert!(!ok);
        // 空 URL 直接返回，既不算成功也没走到 parse，陈旧错误保留
        assert!(src.errors().get().is_some());
        src.errors().clear();
    }
}
