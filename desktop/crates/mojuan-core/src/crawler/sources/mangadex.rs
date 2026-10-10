//! MangaDex 源适配器。
//!
//! 解析与 op URL 构造在源脚本 `js/sources/mangadex.js`；Rust 侧提供网络请求头、标签缓存
//! （categories 的实现 + category 的 tagId）、章节 id 缓存（images 的 chapterId，复用详情
//! feed）。feed 与 tags 的抓取 URL 属缓存层，留在本文件。

use super::{chapter_index, comic_id, ErrorSlot, Source};
use crate::crawler::http;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

const API: &str = "https://api.mangadex.org";
/// 漫画 id 前缀。
const PREFIX: &str = "mangadex-";

pub static MANGADEX: Mangadex = Mangadex;
pub struct Mangadex;

static ERROR: ErrorSlot = ErrorSlot::new();

/// 分类标签缓存：id -> label（跨方法复用，避免重复请求 /manga/tag）。
static TAGS_CACHE: Mutex<Vec<(String, String)>> = Mutex::new(Vec::new());
/// 章节 id 缓存：mangaId -> [{index, id}]（images 复用详情已拉取的 feed）。
static CHAPTER_ID_CACHE: LazyLock<Mutex<HashMap<String, Vec<(f64, String)>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn headers() -> Vec<(&'static str, &'static str)> {
    vec![("User-Agent", "Mojuan/1.0"), ("Accept", "application/json")]
}

fn get_json(url: &str) -> Result<Value, String> {
    http::get_json(url, &headers())
}

fn load_tags() -> Result<(), String> {
    if !TAGS_CACHE.lock().unwrap().is_empty() {
        return Ok(());
    }
    let json = get_json(&format!("{API}/manga/tag"))?;
    let mut tags = Vec::new();
    if let Some(arr) = json.get("data").and_then(|d| d.as_array()) {
        for t in arr {
            let attrs = t.get("attributes");
            if attrs.and_then(|a| a.get("group")).and_then(|g| g.as_str()) != Some("genre") {
                continue;
            }
            let Some(id) = t.get("id").and_then(|v| v.as_str()) else {
                continue;
            };
            let label = pick_localized(attrs.and_then(|a| a.get("name")), "");
            if label.is_empty() {
                continue;
            }
            tags.push((id.to_string(), label));
        }
    }
    *TAGS_CACHE.lock().unwrap() = tags;
    Ok(())
}

/// 分类标签列表（categories op 的 Rust 侧实现）。失败返回 Err（供结果缓存判定是否写入）。
fn categories() -> Result<Vec<String>, String> {
    load_tags()?;
    Ok(TAGS_CACHE
        .lock()
        .unwrap()
        .iter()
        .map(|(_, l)| l.clone())
        .collect())
}

/// label -> tag id（category op 的 ctx；标签未找到返回 None → 脚本 buildUrl 返回空串 → 空结果）。
fn tag_id_for(label: &str) -> Option<String> {
    load_tags().ok()?;
    TAGS_CACHE
        .lock()
        .unwrap()
        .iter()
        .find(|(_, l)| l == label)
        .map(|(id, _)| id.clone())
}

/// 拉取章节 feed（detail 的 ctx 与 images 的 chapterId 共用）。
fn fetch_feed(manga_id: &str) -> Result<Vec<Value>, String> {
    let url = format!(
        "{}/manga/{}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=500&includes[]=scanlation_group",
        API, manga_id
    );
    let json = get_json(&url)?;
    Ok(json
        .get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default())
}

/// mangaId -> [{index, id}]（与脚本 toChapters 相同的去重逻辑，但保留 chapter.id）。
fn chapter_id_list(feed: &[Value]) -> Vec<(f64, String)> {
    let mut seen: Vec<f64> = Vec::new();
    let mut list = Vec::new();
    for ch in feed {
        let Some(num) = chapter_num(ch) else { continue };
        if seen.contains(&num) {
            continue;
        }
        seen.push(num);
        let id = ch.get("id").and_then(|v| v.as_str()).unwrap_or("");
        list.push((num, id.to_string()));
    }
    list
}

/// 章节号：string 或 number，非有限数返回 None。
fn chapter_num(ch: &Value) -> Option<f64> {
    let v = ch.get("attributes")?.get("chapter")?;
    if let Some(s) = v.as_str() {
        s.parse::<f64>().ok().filter(|n| n.is_finite())
    } else {
        v.as_f64().filter(|n| n.is_finite())
    }
}

/// chapterIndex -> chapter id（images 的 ctx；feed 拉取/缓存失败或未找到返回 None）。
fn chapter_id_for(manga_id: &str, index: f64) -> Option<String> {
    let list = {
        let cache = CHAPTER_ID_CACHE.lock().unwrap();
        match cache.get(manga_id) {
            Some(list) => list.clone(),
            None => {
                drop(cache);
                match fetch_feed(manga_id) {
                    Ok(feed) => {
                        let list = chapter_id_list(&feed);
                        CHAPTER_ID_CACHE
                            .lock()
                            .unwrap()
                            .insert(manga_id.to_string(), list.clone());
                        list
                    }
                    Err(_) => Vec::new(),
                }
            }
        }
    };
    list.iter()
        .find(|(idx, _)| *idx == index)
        .map(|(_, id)| id.clone())
}

/// 优先英文/中文/日文/韩文，其次任意值，最后回退 fallback（对应脚本 pickLocalized）。
fn pick_localized(map: Option<&Value>, fallback: &str) -> String {
    let Some(obj) = map.and_then(|m| m.as_object()) else {
        return fallback.to_string();
    };
    for key in ["en", "zh", "ja", "ko"] {
        if let Some(v) = obj.get(key).and_then(|v| v.as_str()) {
            return v.to_string();
        }
    }
    obj.values()
        .next()
        .and_then(|v| v.as_str())
        .unwrap_or(fallback)
        .to_string()
}

impl Source for Mangadex {
    fn title(&self) -> &'static str {
        "MangaDex"
    }

    fn script(&self) -> &'static str {
        include_str!("../../js/sources/mangadex.js")
    }

    fn headers(&self, _op: &str, _ctx: &Value) -> Vec<(&'static str, String)> {
        headers()
            .into_iter()
            .map(|(k, v)| (k, v.to_string()))
            .collect()
    }

    fn ctx(&self, op: &str, payload: &Value) -> Value {
        let manga_id = comic_id(payload).strip_prefix(PREFIX).unwrap_or("");
        match op {
            "category" => {
                let label = payload
                    .get("label")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                json!({ "label": label, "tagId": tag_id_for(label) })
            }
            "detail" => json!({ "feed": fetch_feed(manga_id).unwrap_or_default() }),
            "images" => json!({ "chapterId": chapter_id_for(manga_id, chapter_index(payload)) }),
            _ => json!({}),
        }
    }

    fn native_op(&self, op: &str, _payload: &Value) -> Option<(String, bool)> {
        if op != "categories" {
            return None;
        }
        Some(match categories() {
            Ok(cats) => (
                serde_json::to_string(&cats).unwrap_or_else(|_| "[]".into()),
                true,
            ),
            Err(_) => ("[]".into(), false),
        })
    }

    fn errors(&self) -> &'static ErrorSlot {
        &ERROR
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// categories 是 Rust 直连 op；其余 op 交给脚本。
    #[test]
    fn categories_is_a_native_op() {
        assert!(MANGADEX.native_op("categories", &json!({})).is_some());
        assert_eq!(MANGADEX.native_op("detail", &json!({})), None);
        assert_eq!(MANGADEX.native_op("search", &json!({})), None);
    }

    /// category 的 ctx 带 label 与查到的 tagId（标签表已缓存时不再发请求）。
    #[test]
    fn category_ctx_carries_label_and_tag_id() {
        *TAGS_CACHE.lock().unwrap() = vec![("tag-1".to_string(), "Action".to_string())];
        let ctx = MANGADEX.ctx("category", &json!({"label": "Action"}));
        assert_eq!(ctx["label"], "Action");
        assert_eq!(ctx["tagId"], "tag-1");
        // 标签表里没有的 label → tagId 为 null，脚本按空 URL 返回空结果
        let missing = MANGADEX.ctx("category", &json!({"label": "不存在"}));
        assert!(missing["tagId"].is_null());
    }

    /// 其它 op 的 ctx 为空对象（comicId 前缀剥掉后交给脚本，派生值依赖网络故不在此断言）。
    #[test]
    fn unrelated_ops_have_empty_ctx() {
        assert_eq!(MANGADEX.ctx("categories", &json!({})), json!({}));
        assert_eq!(MANGADEX.ctx("search", &json!({"keyword": "x"})), json!({}));
    }

    #[test]
    fn chapter_num_parses_number_and_string() {
        assert_eq!(chapter_num(&json!({"attributes": {"chapter": 3}})), Some(3.0));
        assert_eq!(
            chapter_num(&json!({"attributes": {"chapter": "1.5"}})),
            Some(1.5)
        );
        assert_eq!(chapter_num(&json!({"attributes": {"chapter": null}})), None);
        assert_eq!(chapter_num(&json!({})), None);
    }

    #[test]
    fn chapter_id_list_dedupes_and_keeps_first() {
        let feed: Vec<Value> = serde_json::from_str(
            r#"[
                {"id": "ch-1", "attributes": {"chapter": "1"}},
                {"id": "ch-2", "attributes": {"chapter": "2"}},
                {"id": "ch-1-dup", "attributes": {"chapter": "1"}}
            ]"#,
        )
        .unwrap();
        assert_eq!(
            chapter_id_list(&feed),
            vec![(1.0, "ch-1".to_string()), (2.0, "ch-2".to_string())]
        );
    }

    #[test]
    fn pick_localized_prefers_known_languages() {
        let map = json!({"ja": "アクション", "en": "Action"});
        assert_eq!(pick_localized(Some(&map), ""), "Action");
        assert_eq!(pick_localized(Some(&json!({"fr": "Action"})), ""), "Action");
        assert_eq!(pick_localized(None, "fallback"), "fallback");
    }
}
