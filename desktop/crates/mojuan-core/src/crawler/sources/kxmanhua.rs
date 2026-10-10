//! 开心看漫画 kxmanhua.com 源适配器。
//!
//! 解析与 op URL 构造全在源脚本 `js/sources/kxmanhua.js`；Rust 侧只提供网络请求头与
//! detail 的 comicId 直通。图片（img.imh99.top）无热链校验，前端直连加载。

use super::{comic_id, ErrorSlot, Source};
use serde_json::{json, Value};

pub static KXMANHUA: Kxmanhua = Kxmanhua;
pub struct Kxmanhua;

static ERROR: ErrorSlot = ErrorSlot::new();

/// 常规 HTML 请求头（浏览器 UA + 中文 + 站内 Referer）。
fn headers() -> Vec<(&'static str, &'static str)> {
    vec![
        (
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        ),
        (
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ),
        ("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8"),
        ("Referer", "https://kxmanhua.com/"),
    ]
}

impl Source for Kxmanhua {
    fn title(&self) -> &'static str {
        "开心看漫画"
    }

    fn script(&self) -> &'static str {
        include_str!("../../js/sources/kxmanhua.js")
    }

    fn headers(&self, _op: &str, _ctx: &Value) -> Vec<(&'static str, String)> {
        headers()
            .into_iter()
            .map(|(k, v)| (k, v.to_string()))
            .collect()
    }

    /// detail 解析按 comicId 过滤本作章节（同类推荐锚不混入）。
    fn ctx(&self, op: &str, payload: &Value) -> Value {
        if op != "detail" {
            return json!({});
        }
        json!({ "comicId": comic_id(payload) })
    }

    fn errors(&self) -> &'static ErrorSlot {
        &ERROR
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detail_ctx_passes_comic_id_through() {
        let ctx = KXMANHUA.ctx("detail", &json!({"comicId": "kxmanhua-abc"}));
        assert_eq!(ctx["comicId"], "kxmanhua-abc");
        assert_eq!(KXMANHUA.ctx("search", &json!({})), json!({}));
    }

    #[test]
    fn headers_carry_site_referer() {
        let hs = KXMANHUA.headers("detail", &json!({}));
        assert!(hs.contains(&("Referer", "https://kxmanhua.com/".to_string())));
    }
}
