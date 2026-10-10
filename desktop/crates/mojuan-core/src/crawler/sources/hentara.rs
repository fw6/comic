//! Hentara hentara.com 源适配器。
//!
//! 解析与 op URL 构造全在源脚本 `js/sources/hentara.js`（取站点自带的静态 JSON 数据接口）；
//! Rust 侧只提供网络请求头与 search 的 keyword 直通。图片（cdn.hentara.com）无热链校验，
//! 前端直连加载。

use super::{ErrorSlot, Source};
use serde_json::{json, Value};

pub static HENTARA: Hentara = Hentara;
pub struct Hentara;

static ERROR: ErrorSlot = ErrorSlot::new();

/// 常规请求头（浏览器 UA；站点与数据 CDN 均无 IP 风控）。
fn headers() -> Vec<(&'static str, &'static str)> {
    vec![
        (
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        ),
        (
            "Accept",
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        ),
        ("Accept-Language", "en-US,en;q=0.9"),
    ]
}

impl Source for Hentara {
    fn title(&self) -> &'static str {
        "Hentara"
    }

    fn script(&self) -> &'static str {
        include_str!("../../js/sources/hentara.js")
    }

    fn headers(&self, _op: &str, _ctx: &Value) -> Vec<(&'static str, String)> {
        headers()
            .into_iter()
            .map(|(k, v)| (k, v.to_string()))
            .collect()
    }

    /// 搜索在脚本内过滤站点的 index.json（搜索词经 ctx 传入）。
    fn ctx(&self, op: &str, payload: &Value) -> Value {
        if op != "search" {
            return json!({});
        }
        let keyword = payload
            .get("keyword")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        json!({ "keyword": keyword })
    }

    fn errors(&self) -> &'static ErrorSlot {
        &ERROR
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_ctx_carries_keyword_and_others_are_empty() {
        let ctx = HENTARA.ctx("search", &json!({"keyword": "abc"}));
        assert_eq!(ctx["keyword"], "abc");
        assert_eq!(HENTARA.ctx("detail", &json!({"comicId": "hentara-x"})), json!({}));
        assert_eq!(HENTARA.ctx("categories", &json!({})), json!({}));
    }

    #[test]
    fn missing_keyword_becomes_empty_string() {
        assert_eq!(HENTARA.ctx("search", &json!({}))["keyword"], "");
    }
}
