//! MangaDex 图源（脚本源，wayfinder #11/#15/#16 定案）。
//! 解析与 op URL 构造在源脚本 `js/sources/mangadex.js`；本模块保留 Rust 侧职责：
//! 标签缓存（categories 实现 + category 的 tagId）、章节 id 缓存（images 的
//! chapterId 解析，复用详情 feed）。feed/tags 的抓取 URL 属缓存层，留 Rust，
//! 取数经 `crawler::fetch`（JSON 接口取原始文本，见 `render::HTML_SCRIPT`）。

use serde_json::Value;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

const API: &str = "https://api.mangadex.org";
pub const MANGA_PREFIX: &str = "mangadex-";

/// 分类标签缓存：id -> label（跨方法复用，避免重复请求 /manga/tag）。
static TAGS_CACHE: Mutex<Vec<(String, String)>> = Mutex::new(Vec::new());
/// 章节 id 缓存：mangaId -> [{index, id}]（images 复用详情已拉取的 feed）。
static CHAPTER_ID_CACHE: LazyLock<Mutex<HashMap<String, Vec<(f64, String)>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn get_json(url: &str) -> Result<Value, String> {
    let body = super::fetch("mangadex", url)?;
    serde_json::from_str(&body).map_err(|e| e.to_string())
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
pub fn categories() -> Result<Vec<String>, String> {
    load_tags()?;
    Ok(TAGS_CACHE
        .lock()
        .unwrap()
        .iter()
        .map(|(_, l)| l.clone())
        .collect())
}

/// label -> tag id（category op 的 ctx；标签未找到返回 None → 脚本 buildUrl 返回空串 → 空结果）。
pub fn tag_id_for(label: &str) -> Option<String> {
    load_tags().ok()?;
    TAGS_CACHE
        .lock()
        .unwrap()
        .iter()
        .find(|(_, l)| l == label)
        .map(|(id, _)| id.clone())
}

/// 拉取章节 feed（detail 的 ctx 与 images 的 chapterId 共用）。
pub fn fetch_feed(manga_id: &str) -> Result<Vec<Value>, String> {
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
pub fn chapter_id_for(manga_id: &str, index: f64) -> Option<String> {
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
    list.iter().find(|(idx, _)| *idx == index).map(|(_, id)| id.clone())
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
