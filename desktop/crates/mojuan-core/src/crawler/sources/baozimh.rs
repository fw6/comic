//! 包子漫画源适配器。
//!
//! 整源经渲染通道取页面（Cloudflare 防护），解析与 op URL 构造在源脚本
//! `js/sources/baozimh.js`；Rust 侧提供章节中转链（page_direct）URL 的进程内缓存。
//!
//! 详情页章节锚是 `/user/page_direct?comic_id={站内id}&section_slot={s}&chapter_slot={n}`
//! 中转链，站内 id 无法从公开 slug 推出；detail 解析每章输出隐藏字段 `pageUrl`，
//! [`Source::post_process`] 提取入本缓存并剥离字段，images 的 ctx 从缓存取（同 webtoons
//! seriesUrl / copymanga chapterUuid 的形状）。
//!
//! 缓存驻留进程内：应用重启后首次进详情页即重建；未重建时 images 无 URL，按空结果返回。

use super::{chapter_index, comic_id, ErrorSlot, Source};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

pub static BAOZIMH: Baozimh = Baozimh;
pub struct Baozimh;

static ERROR: ErrorSlot = ErrorSlot::new();

/// comicId -> (章节 index -> 中转链 URL)
static PAGE_URLS: LazyLock<Mutex<HashMap<String, HashMap<i64, String>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 详情解析后写入某漫画的章节 URL 表（覆盖旧值）。
fn cache_chapters(comic_id: &str, entries: Vec<(i64, String)>) {
    let mut cache = PAGE_URLS.lock().unwrap();
    let slot = cache.entry(comic_id.to_string()).or_default();
    for (index, url) in entries {
        slot.insert(index, url);
    }
}

/// 取某章的中转链 URL。
fn page_url_for(comic_id: &str, index: i64) -> Option<String> {
    PAGE_URLS
        .lock()
        .unwrap()
        .get(comic_id)
        .and_then(|slot| slot.get(&index))
        .cloned()
}

impl Source for Baozimh {
    fn title(&self) -> &'static str {
        "包子漫画"
    }

    fn script(&self) -> &'static str {
        include_str!("../../js/sources/baozimh.js")
    }

    fn render_channel(&self) -> bool {
        true
    }

    fn ctx(&self, op: &str, payload: &Value) -> Value {
        let id = comic_id(payload);
        match op {
            "detail" => json!({ "comicId": id }),
            "images" => json!({
                "pageUrl": page_url_for(id, chapter_index(payload) as i64).unwrap_or_default(),
            }),
            _ => json!({}),
        }
    }

    /// detail 把每章的隐藏字段 pageUrl 提取进缓存并剥离（前端契约不变）。
    fn post_process(&self, op: &str, json: &str) -> String {
        if op != "detail" {
            return json.to_string();
        }
        let mut v: Value = match serde_json::from_str(json) {
            Ok(v) => v,
            Err(_) => return json.to_string(),
        };
        let comic_id = v
            .pointer("/comic/id")
            .and_then(|i| i.as_str())
            .unwrap_or("")
            .to_string();
        let mut entries: Vec<(i64, String)> = Vec::new();
        if let Some(chapters) = v.get_mut("chapters").and_then(|c| c.as_array_mut()) {
            for ch in chapters.iter_mut() {
                let Some(obj) = ch.as_object_mut() else {
                    continue;
                };
                let url = obj
                    .remove("pageUrl")
                    .and_then(|u| u.as_str().map(String::from));
                let (Some(url), Some(idx)) = (url, obj.get("index").and_then(|i| i.as_f64()))
                else {
                    continue;
                };
                if !url.is_empty() {
                    entries.push((idx as i64, url));
                }
            }
        }
        if !comic_id.is_empty() {
            cache_chapters(&comic_id, entries);
        }
        v.to_string()
    }

    fn errors(&self) -> &'static ErrorSlot {
        &ERROR
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// detail 后处理把 pageUrl 提取进缓存并从结果里剥离。
    #[test]
    fn detail_page_url_cached_and_stripped() {
        let json = r#"{
            "comic": {"id": "baozimh-haizeiwang-y", "title": "海贼王"},
            "chapters": [
                {"index": 1, "title": "第1话", "pageUrl": "https://cn.baozimh.com/user/page_direct?comic_id=a_i1&section_slot=0&chapter_slot=0"},
                {"index": 2, "title": "第2话", "pageUrl": "https://cn.baozimh.com/user/page_direct?comic_id=a_i1&section_slot=0&chapter_slot=1"}
            ]
        }"#;
        let out = BAOZIMH.post_process("detail", json);
        let v: Value = serde_json::from_str(&out).unwrap();
        assert!(v["chapters"][0].get("pageUrl").is_none());
        assert_eq!(v["chapters"][0]["title"], "第1话");
        assert!(page_url_for("baozimh-haizeiwang-y", 2)
            .unwrap()
            .contains("chapter_slot=1"));
    }

    /// images 的 ctx 取缓存里的中转链（comicId 原样传入，不剥前缀）。
    #[test]
    fn images_ctx_reads_cached_page_url() {
        cache_chapters(
            "baozimh-ctx",
            vec![(3, "https://cn.baozimh.com/user/page_direct?chapter_slot=2".to_string())],
        );
        let ctx = BAOZIMH.ctx("images", &json!({"comicId": "baozimh-ctx", "chapterIndex": 3}));
        assert_eq!(
            ctx["pageUrl"],
            "https://cn.baozimh.com/user/page_direct?chapter_slot=2"
        );
        // 未重建缓存时为空串，脚本按空 URL 返回空结果
        let missing = BAOZIMH.ctx("images", &json!({"comicId": "baozimh-ctx", "chapterIndex": 99}));
        assert_eq!(missing["pageUrl"], "");
        // detail 的 ctx 直通 comicId
        assert_eq!(
            BAOZIMH.ctx("detail", &json!({"comicId": "baozimh-ctx"}))["comicId"],
            "baozimh-ctx"
        );
    }

    #[test]
    fn cache_and_lookup() {
        cache_chapters(
            "baozimh-hanghaiwang-x",
            vec![
                (1, "https://cn.baozimh.com/user/page_direct?comic_id=a&section_slot=0&chapter_slot=0".to_string()),
                (2, "https://cn.baozimh.com/user/page_direct?comic_id=a&section_slot=0&chapter_slot=1".to_string()),
            ],
        );
        assert!(page_url_for("baozimh-hanghaiwang-x", 2)
            .unwrap()
            .contains("chapter_slot=1"));
        assert!(page_url_for("baozimh-hanghaiwang-x", 99).is_none());
        assert!(page_url_for("baozimh-unknown", 1).is_none());
    }

    #[test]
    fn cache_overwrites_same_index() {
        cache_chapters("baozimh-x", vec![(1, "old".to_string())]);
        cache_chapters("baozimh-x", vec![(1, "new".to_string())]);
        assert_eq!(page_url_for("baozimh-x", 1).as_deref(), Some("new"));
    }

    #[test]
    fn post_process_passthrough_on_bad_json_and_other_ops() {
        assert_eq!(BAOZIMH.post_process("detail", "not json"), "not json");
        let list = r#"[{"id":"baozimh-x"}]"#;
        assert_eq!(BAOZIMH.post_process("search", list), list);
    }

    /// 渲染通道由 adapter 声明（Cloudflare 防护源）。
    #[test]
    fn declares_render_channel() {
        assert!(BAOZIMH.render_channel());
    }
}
