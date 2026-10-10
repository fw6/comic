//! 鸟鸟韩漫源适配器。
//!
//! 整源经渲染通道取页面（整站 TLS 连接对本机重置，普通 HTTP 客户端拿不到页面），解析与
//! op URL 构造全在源脚本 `js/sources/nnhanman.js`；Rust 侧只提供 detail 的 comicId 直通。

use super::{comic_id, ErrorSlot, Source};
use serde_json::{json, Value};

pub static NNHANMAN: Nnhanman = Nnhanman;
pub struct Nnhanman;

static ERROR: ErrorSlot = ErrorSlot::new();

impl Source for Nnhanman {
    fn title(&self) -> &'static str {
        "鸟鸟韩漫"
    }

    fn script(&self) -> &'static str {
        include_str!("../../js/sources/nnhanman.js")
    }

    fn render_channel(&self) -> bool {
        true
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
    fn declares_render_channel_and_passes_comic_id() {
        assert!(NNHANMAN.render_channel());
        let ctx = NNHANMAN.ctx("detail", &json!({"comicId": "nnhanman-abc"}));
        assert_eq!(ctx["comicId"], "nnhanman-abc");
        assert_eq!(NNHANMAN.ctx("images", &json!({"comicId": "nnhanman-abc"})), json!({}));
    }
}
