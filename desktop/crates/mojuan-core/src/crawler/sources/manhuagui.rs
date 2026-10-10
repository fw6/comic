//! 漫画柜 manhuagui.com 源适配器。
//!
//! 解析与 op URL 构造全在源脚本 `js/sources/manhuagui.js`（含章节页 p.a.c.k.e.r 解包 →
//! path/files/sl → hamreus 图片 URL）；Rust 侧只提供网络请求头与 detail 的 comicId 直通。
//! 图片（us.hamreus.com）由前端图片代理按 [`Source::hotlink_referers`] 带 Referer 拉取。

use super::{comic_id, ErrorSlot, HotlinkReferer, Source};
use serde_json::{json, Value};

/// 漫画 id 前缀。
const PREFIX: &str = "manhuagui-";

pub static MANHUAGUI: Manhuagui = Manhuagui;
pub struct Manhuagui;

static ERROR: ErrorSlot = ErrorSlot::new();

/// 常规 HTML 请求头（浏览器 UA + 中文）。
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
    ]
}

impl Source for Manhuagui {
    fn title(&self) -> &'static str {
        "漫画柜"
    }

    fn script(&self) -> &'static str {
        include_str!("../../js/sources/manhuagui.js")
    }

    fn headers(&self, _op: &str, _ctx: &Value) -> Vec<(&'static str, String)> {
        headers()
            .into_iter()
            .map(|(k, v)| (k, v.to_string()))
            .collect()
    }

    /// detail 解析需按 `/comic/{id}/` 过滤本漫画章节（同类推荐的其它漫画链接不进来）。
    fn ctx(&self, op: &str, payload: &Value) -> Value {
        if op != "detail" {
            return json!({});
        }
        let id = comic_id(payload).strip_prefix(PREFIX).unwrap_or("");
        json!({ "comicId": id })
    }

    fn hotlink_referers(&self) -> &'static [HotlinkReferer] {
        &[HotlinkReferer {
            domain: "hamreus.com",
            referer: "https://www.manhuagui.com/",
        }]
    }

    fn errors(&self) -> &'static ErrorSlot {
        &ERROR
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detail_ctx_strips_prefix_and_others_are_empty() {
        let ctx = MANHUAGUI.ctx("detail", &json!({"comicId": "manhuagui-12345"}));
        assert_eq!(ctx["comicId"], "12345");
        assert_eq!(MANHUAGUI.ctx("search", &json!({"keyword": "x"})), json!({}));
        assert_eq!(MANHUAGUI.ctx("images", &json!({"comicId": "manhuagui-1"})), json!({}));
    }

    #[test]
    fn hotlink_domain_is_declared() {
        let refs = MANHUAGUI.hotlink_referers();
        assert_eq!(refs.len(), 1);
        assert_eq!(refs[0].domain, "hamreus.com");
        assert_eq!(refs[0].referer, "https://www.manhuagui.com/");
    }
}
