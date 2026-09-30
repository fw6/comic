//! 包子漫画 Rust 侧：章节中转链（page_direct）URL 的进程内缓存。
//!
//! 详情页章节锚是 `/user/page_direct?comic_id={站内id}&section_slot={s}&chapter_slot={n}`
//! 中转链，站内 id 无法从公开 slug 推出；detail 解析每章输出隐藏字段 `pageUrl`，
//! `script::post_process` 提取入本缓存并剥离字段，images 的 `build_ctx` 从缓存取
//! （同 webtoons seriesUrl / copymanga chapterUuid 的形状）。
//!
//! 缓存驻留进程内：应用重启后首次进详情页即重建；未重建时 images 无 URL，按
//! 空结果返回（与 copymanga 缓存未命中行为一致）。

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

/// 漫画 id 前缀（`baozimh-{slug}`）。
pub const PREFIX: &str = "baozimh-";

/// comicId -> (章节 index -> 中转链 URL)
static PAGE_URLS: LazyLock<Mutex<HashMap<String, HashMap<i64, String>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 详情解析后写入某漫画的章节 URL 表（覆盖旧值）。
pub fn cache_chapters(comic_id: &str, entries: Vec<(i64, String)>) {
    let mut cache = PAGE_URLS.lock().unwrap();
    let slot = cache.entry(comic_id.to_string()).or_default();
    for (index, url) in entries {
        slot.insert(index, url);
    }
}

/// 取某章的中转链 URL。
pub fn page_url_for(comic_id: &str, index: i64) -> Option<String> {
    PAGE_URLS
        .lock()
        .unwrap()
        .get(comic_id)
        .and_then(|slot| slot.get(&index))
        .cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
