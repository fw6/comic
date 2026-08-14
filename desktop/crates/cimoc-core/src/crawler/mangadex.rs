//! MangaDex 图源（官方公开 JSON API）。
//! 移植自 app 侧 `src/cimoc/data/mangadex.ts`，语义与字段映射保持一致。

use crate::crawler::http;
use crate::crawler::models::{Chapter, Comic, Detail};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

const API: &str = "https://api.mangadex.org";
const COVER_CDN: &str = "https://uploads.mangadex.org/covers";
/// 搜索/分类仅取适合大众的内容（排除成人分级）
const CONTENT: &str = "contentRating[]=safe&contentRating[]=suggestive";
const MANGA_PREFIX: &str = "mangadex-";

/// 分类标签缓存：id -> label（跨方法复用，避免重复请求 /manga/tag）
static TAGS_CACHE: Mutex<Vec<(String, String)>> = Mutex::new(Vec::new());
/// 章节 id 缓存：mangaId -> [{index, id}]（fetchChapterImages 复用详情已拉取的 feed）
static CHAPTER_ID_CACHE: LazyLock<Mutex<HashMap<String, Vec<(f64, String)>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 单方法入口：op 见 crawler/mod.rs 协议；失败返回空 JSON。
pub fn crawl(op: &str, payload: &Value) -> String {
    match op {
        "categories" => serde_json::to_string(&categories()).unwrap_or_else(|_| "[]".into()),
        "search" => {
            let kw = payload.get("keyword").and_then(|v| v.as_str()).unwrap_or("");
            serde_json::to_string(&search(kw)).unwrap_or_else(|_| "[]".into())
        }
        "category" => {
            let label = payload.get("label").and_then(|v| v.as_str()).unwrap_or("");
            serde_json::to_string(&category(label)).unwrap_or_else(|_| "[]".into())
        }
        "detail" => {
            let id = payload.get("comicId").and_then(|v| v.as_str()).unwrap_or("");
            let manga_id = id.strip_prefix(MANGA_PREFIX).unwrap_or("");
            match detail(manga_id) {
                Some(d) => serde_json::to_string(&d).unwrap_or_else(|_| "{}".into()),
                None => "{}".into(),
            }
        }
        "images" => {
            let id = payload.get("comicId").and_then(|v| v.as_str()).unwrap_or("");
            let manga_id = id.strip_prefix(MANGA_PREFIX).unwrap_or("");
            let idx = payload.get("chapterIndex").and_then(|v| v.as_f64()).unwrap_or(0.0);
            serde_json::to_string(&images(manga_id, idx)).unwrap_or_else(|_| "[]".into())
        }
        _ => "[]".into(),
    }
}

fn headers() -> Vec<(&'static str, &'static str)> {
    vec![("User-Agent", "Cimoc/1.0"), ("Accept", "application/json")]
}

fn get_json(url: &str) -> Result<Value, String> {
    http::get_json(url, &headers())
}

/// 优先英文/中文/日文/韩文，其次任意值，最后回退 fallback（对应 TS pickLocalized）。
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

/// 去 HTML 标签 + 折叠空白（对应 TS stripHtml）。
fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn rel<'a>(node: &'a Value, ty: &str) -> Option<&'a Value> {
    node.get("relationships")?
        .as_array()?
        .iter()
        .find(|r| r.get("type").and_then(|t| t.as_str()) == Some(ty))
}

fn to_comic(node: &Value) -> Comic {
    let attrs = node.get("attributes");
    let id = node.get("id").and_then(|v| v.as_str()).unwrap_or("");
    let title = attrs.and_then(|a| a.get("title"));
    let desc = attrs.and_then(|a| a.get("description"));
    let cover = rel(node, "cover_art")
        .and_then(|r| r.get("attributes"))
        .and_then(|a| a.get("fileName"))
        .and_then(|f| f.as_str());
    let author = rel(node, "author")
        .and_then(|r| r.get("attributes"))
        .and_then(|a| a.get("name"))
        .and_then(|n| n.as_str())
        .unwrap_or("");
    let status = attrs.and_then(|a| a.get("status")).and_then(|s| s.as_str());
    let tags = attrs
        .and_then(|a| a.get("tags"))
        .and_then(|t| t.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|t| {
                    let label = pick_localized(
                        t.get("attributes").and_then(|a| a.get("name")),
                        "",
                    );
                    if label.is_empty() {
                        None
                    } else {
                        Some(label)
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    Comic {
        id: format!("mangadex-{}", id),
        source: "mangadex".into(),
        source_title: "MangaDex".into(),
        title: pick_localized(title, "Manga"),
        author: author.into(),
        intro: strip_html(&pick_localized(desc, "")),
        cover: cover
            .map(|f| format!("{}/{}/{}.256.jpg", COVER_CDN, id, f))
            .unwrap_or_default(),
        status: if status == Some("completed") {
            "finish".into()
        } else {
            "serial".into()
        },
        update_time: String::new(),
        last_chapter: String::new(),
        tags,
        last_read_chapter: 0,
        last_read_time: 0,
    }
}

/// 章节号：string 或 number，非有限数返回 None（对应 TS 的 NaN 跳过）。
fn chapter_num(ch: &Value) -> Option<f64> {
    let v = ch.get("attributes")?.get("chapter")?;
    if let Some(s) = v.as_str() {
        s.parse::<f64>().ok().filter(|n| n.is_finite())
    } else {
        v.as_f64().filter(|n| n.is_finite())
    }
}

/// feed 章节数组 → Chapter[]（编号升序、去重、标题回退）。
pub fn to_chapters(feed: &[Value]) -> Vec<Chapter> {
    let mut seen: Vec<f64> = Vec::new();
    let mut chapters = Vec::new();
    for ch in feed {
        let Some(num) = chapter_num(ch) else { continue };
        if seen.contains(&num) {
            continue;
        }
        seen.push(num);
        let title = ch
            .get("attributes")
            .and_then(|a| a.get("title"))
            .and_then(|t| t.as_str())
            .map(|t| t.to_string())
            .unwrap_or_else(|| format!("第 {} 话", num));
        chapters.push(Chapter {
            index: num,
            title,
            pages: Vec::new(),
            downloaded: false,
            read: false,
        });
    }
    chapters
}

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

pub fn parse_search(json: &Value) -> Vec<Comic> {
    json.get("data")
        .and_then(|d| d.as_array())
        .map(|arr| arr.iter().map(to_comic).collect())
        .unwrap_or_default()
}

pub fn parse_categories(json: &Value) -> Vec<String> {
    json.get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter(|t| {
                    t.get("attributes")
                        .and_then(|a| a.get("group"))
                        .and_then(|g| g.as_str())
                        == Some("genre")
                })
                .filter_map(|t| {
                    let label = pick_localized(
                        t.get("attributes").and_then(|a| a.get("name")),
                        "",
                    );
                    if label.is_empty() {
                        None
                    } else {
                        Some(label)
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

fn load_tags() -> Result<(), String> {
    if !TAGS_CACHE.lock().unwrap().is_empty() {
        return Ok(());
    }
    let json = get_json(&format!("{}/manga/tag", API))?;
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

fn categories() -> Vec<String> {
    load_tags()
        .map(|_| TAGS_CACHE.lock().unwrap().iter().map(|(_, l)| l.clone()).collect())
        .unwrap_or_default()
}

fn search(keyword: &str) -> Vec<Comic> {
    let url = format!(
        "{}/manga?title={}&limit=24&includes[]=cover_art&includes[]=author&{}&order[relevance]=desc",
        API,
        http::encode_uri_component(keyword),
        CONTENT
    );
    get_json(&url).map(|j| parse_search(&j)).unwrap_or_default()
}

fn category(label: &str) -> Vec<Comic> {
    let id = match load_tags() {
        Ok(()) => TAGS_CACHE
            .lock()
            .unwrap()
            .iter()
            .find(|(_, l)| l == label)
            .map(|(id, _)| id.clone()),
        Err(_) => None,
    };
    let Some(id) = id else { return Vec::new() };
    let url = format!(
        "{}/manga?includedTags[]={}&limit=24&includes[]=cover_art&includes[]=author&{}",
        API, id, CONTENT
    );
    get_json(&url).map(|j| parse_search(&j)).unwrap_or_default()
}

pub fn parse_detail(manga_json: &Value, feed: &[Value]) -> Option<Detail> {
    let node = manga_json.get("data")?;
    if node.get("id").is_none() {
        return None;
    }
    let mut comic = to_comic(node);
    let chapters = to_chapters(feed);
    comic.last_chapter = chapters
        .last()
        .map(|c| c.title.clone())
        .unwrap_or_default();
    Some(Detail { comic, chapters })
}

fn detail(manga_id: &str) -> Option<Detail> {
    let manga_url = format!(
        "{}/manga/{}?includes[]=author&includes[]=artist&includes[]=cover_art",
        API, manga_id
    );
    let manga_json = get_json(&manga_url).ok()?;
    let feed = fetch_feed(manga_id).unwrap_or_default();
    parse_detail(&manga_json, &feed)
}

pub fn parse_at_home(json: &Value) -> Vec<String> {
    let base = json.get("baseUrl").and_then(|b| b.as_str());
    let ch = json.get("chapter");
    let hash = ch.and_then(|c| c.get("hash")).and_then(|h| h.as_str());
    let data = ch.and_then(|c| c.get("data")).and_then(|d| d.as_array());
    match (base, hash, data) {
        (Some(base), Some(hash), Some(data)) => data
            .iter()
            .filter_map(|f| f.as_str())
            .map(|f| format!("{}/data/{}/{}", base, hash, f))
            .collect(),
        _ => Vec::new(),
    }
}

/// mangaId -> [{index, id}]（与 toChapters 相同的去重逻辑，但保留 chapter.id）。
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

fn images(manga_id: &str, chapter_index: f64) -> Vec<String> {
    let list = {
        let cache = CHAPTER_ID_CACHE.lock().unwrap();
        match cache.get(manga_id) {
            Some(list) => list.clone(),
            None => match fetch_feed(manga_id) {
                Ok(feed) => {
                    let list = chapter_id_list(&feed);
                    drop(cache);
                    CHAPTER_ID_CACHE
                        .lock()
                        .unwrap()
                        .insert(manga_id.to_string(), list.clone());
                    list
                }
                Err(_) => Vec::new(),
            },
        }
    };
    let Some((_, id)) = list.iter().find(|(idx, _)| *idx == chapter_index) else {
        return Vec::new();
    };
    get_json(&format!("{}/at-home/server/{}", API, id))
        .map(|j| parse_at_home(&j))
        .unwrap_or_default()
}
