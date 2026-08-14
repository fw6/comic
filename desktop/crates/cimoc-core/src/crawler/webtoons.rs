//! Webtoons 图源（HTML 爬虫）。
//! 移植自 app 侧 `src/cimoc/data/webtoons.ts`：用 scraper（html5ever + CSS 选择器）
//! 替换原正则解析，语义与选择目标保持一致。

use crate::crawler::http;
use crate::crawler::models::{Chapter, Comic, Detail};
use scraper::{Html, Selector};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

const BASE: &str = "https://www.webtoons.com/en";
const WEBTOONS_PREFIX: &str = "webtoons-";

const UA_HEADERS: [(&str, &str); 3] = [
    (
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    ),
    (
        "Accept",
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ),
    ("Accept-Language", "en-US,en;q=0.9"),
];

const GENRES: [(&str, &str); 8] = [
    ("action", "动作"),
    ("romance", "恋爱"),
    ("comedy", "搞笑"),
    ("drama", "剧情"),
    ("fantasy", "奇幻"),
    ("horror", "恐怖"),
    ("sci-fi", "科幻"),
    ("sports", "体育"),
];

/// 系列 URL 缓存（含 genre slug）：titleNo -> 详情页 URL，跨会话经 cache_dump/hydrate 持久化。
static SERIES_URL_CACHE: LazyLock<Mutex<HashMap<String, String>>> =
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
            let title_no = id.strip_prefix(WEBTOONS_PREFIX).unwrap_or("");
            match detail(title_no) {
                Some(d) => serde_json::to_string(&d).unwrap_or_else(|_| "{}".into()),
                None => "{}".into(),
            }
        }
        "images" => {
            let id = payload.get("comicId").and_then(|v| v.as_str()).unwrap_or("");
            let title_no = id.strip_prefix(WEBTOONS_PREFIX).unwrap_or("");
            let ep = payload.get("chapterIndex").and_then(|v| v.as_i64()).unwrap_or(0);
            serde_json::to_string(&images(title_no, ep)).unwrap_or_else(|_| "[]".into())
        }
        "cache_dump" => {
            serde_json::to_string(&*SERIES_URL_CACHE.lock().unwrap()).unwrap_or_else(|_| "{}".into())
        }
        "cache_hydrate" => hydrate(payload),
        _ => "[]".into(),
    }
}

fn headers() -> Vec<(&'static str, &'static str)> {
    UA_HEADERS.to_vec()
}

fn sel(s: &str) -> Selector {
    Selector::parse(s).expect("valid selector")
}

fn collapse(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn extract_title_no(url: &str) -> Option<String> {
    let rest = url.get(url.find("title_no=")? + "title_no=".len()..)?;
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() {
        None
    } else {
        Some(digits)
    }
}

fn extract_episode_no(url: &str) -> Option<i64> {
    let rest = url.get(url.find("episode_no=")? + "episode_no=".len()..)?;
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().ok()
}

pub fn slug_from_series_url(url: &str) -> Option<String> {
    let after = url.strip_prefix("https://www.webtoons.com/en/")?;
    let slug = after.split("/list?").next()?;
    if slug.is_empty() || !slug.contains('/') {
        None
    } else {
        Some(slug.to_string())
    }
}

fn is_image_url(s: &str) -> bool {
    let lower = s.to_ascii_lowercase();
    [".jpg", ".jpeg", ".png", ".webp"]
        .iter()
        .any(|ext| lower.contains(ext))
}

pub fn categories() -> Vec<String> {
    GENRES.iter().map(|(_, label)| label.to_string()).collect()
}

fn series_list_url(kind: &str, keyword: &str) -> String {
    if kind == "search" {
        format!("{}/search?keyword={}", BASE, http::encode_uri_component(keyword))
    } else {
        let genre = GENRES
            .iter()
            .find(|(_, label)| *label == keyword)
            .map(|(key, _)| *key)
            .unwrap_or(GENRES[0].0);
        format!("{}/genres/{}", BASE, genre)
    }
}

/// 从分类页/搜索页解析系列卡片列表。
pub fn parse_series_list(html: &str) -> Vec<Comic> {
    let document = Html::parse_document(html);
    let link_sel = sel("a[href*='/list?title_no=']");
    let title_sel = sel("strong.title");
    let subj_sel = sel("p.subj");
    let img_sel = sel("img");

    let mut comics = Vec::new();
    let mut seen: Vec<String> = Vec::new();
    for el in document.select(&link_sel) {
        let href = el.value().attr("href").unwrap_or("");
        if !href.starts_with("https://www.webtoons.com/en/") {
            continue;
        }
        let Some(id) = extract_title_no(href) else { continue };
        if seen.contains(&id) {
            continue;
        }
        seen.push(id.clone());
        SERIES_URL_CACHE.lock().unwrap().insert(id.clone(), href.to_string());

        let title = el
            .select(&title_sel)
            .next()
            .map(|n| collapse(&n.text().collect::<String>()))
            .filter(|s| !s.is_empty())
            .or_else(|| {
                el.select(&subj_sel)
                    .next()
                    .map(|n| collapse(&n.text().collect::<String>()))
                    .filter(|s| !s.is_empty())
            })
            .or_else(|| {
                el.select(&img_sel).next().and_then(|img| {
                    img.value()
                        .attr("alt")
                        .map(collapse)
                        .filter(|s| !s.is_empty())
                })
            })
            .or_else(|| el.value().attr("title").map(collapse).filter(|s| !s.is_empty()))
            .unwrap_or_else(|| format!("Webtoon {}", id));

        let cover = el
            .select(&img_sel)
            .next()
            .and_then(|img| {
                img.value()
                    .attr("data-src")
                    .or_else(|| img.value().attr("src"))
            })
            .filter(|s| is_image_url(s))
            .unwrap_or("")
            .to_string();

        comics.push(Comic {
            id: format!("webtoons-{}", id),
            source: "webtoons".into(),
            source_title: "Webtoons".into(),
            title,
            author: String::new(),
            intro: String::new(),
            cover,
            status: "serial".into(),
            update_time: String::new(),
            last_chapter: String::new(),
            tags: Vec::new(),
            last_read_chapter: 0,
            last_read_time: 0,
        });
        if comics.len() >= 24 {
            break;
        }
    }
    comics
}

fn search(keyword: &str) -> Vec<Comic> {
    let url = series_list_url("search", keyword);
    http::get_text(&url, &headers())
        .map(|html| parse_series_list(&html))
        .unwrap_or_default()
}

fn category(label: &str) -> Vec<Comic> {
    let url = series_list_url("category", label);
    http::get_text(&url, &headers())
        .map(|html| parse_series_list(&html))
        .unwrap_or_default()
}

pub fn parse_detail(html: &str, title_no: &str) -> Detail {
    let document = Html::parse_document(html);

    let title = document
        .select(&sel("h1.subj"))
        .next()
        .map(|n| collapse(&n.text().collect::<String>()))
        .filter(|s| !s.is_empty())
        .or_else(|| {
            document
                .select(&sel("h1"))
                .next()
                .map(|n| collapse(&n.text().collect::<String>()))
                .filter(|s| !s.is_empty())
        })
        .or_else(|| {
            document
                .select(&sel("title"))
                .next()
                .map(|n| collapse(&n.text().collect::<String>()))
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| format!("Webtoon {}", title_no));

    let cover = document
        .select(&sel("meta[property='og:image']"))
        .next()
        .and_then(|m| m.value().attr("content"))
        .filter(|s| !s.is_empty())
        .or_else(|| {
            document
                .select(&sel("img.thumb"))
                .next()
                .and_then(|img| img.value().attr("src"))
                .filter(|s| !s.is_empty())
        })
        .or_else(|| {
            document
                .select(&sel("img"))
                .filter_map(|img| img.value().attr("src"))
                .find(|s| s.contains("webtoon-phinf.pstatic.net"))
        })
        .unwrap_or("")
        .to_string();

    let author = document
        .select(&sel(".author"))
        .next()
        .map(|n| collapse(&n.text().collect::<String>()))
        .map(|s| s.split('/').next().unwrap_or("").trim().to_string())
        .unwrap_or_default();

    let intro = document
        .select(&sel("p.summary"))
        .next()
        .map(|n| collapse(&n.text().collect::<String>()))
        .unwrap_or_default();

    let comic = Comic {
        id: format!("webtoons-{}", title_no),
        source: "webtoons".into(),
        source_title: "Webtoons".into(),
        title,
        author,
        intro,
        cover,
        status: "serial".into(),
        update_time: String::new(),
        last_chapter: String::new(),
        tags: vec!["Webtoons".into()],
        last_read_chapter: 0,
        last_read_time: 0,
    };

    let link_sel = sel("a[href*='/viewer?']");
    let img_sel = sel("img");
    let subj_sel = sel("span.subj");
    let inner_span_sel = sel("span");
    let mut chapters: Vec<Chapter> = Vec::new();
    let mut seen_ep: Vec<i64> = Vec::new();
    for el in document.select(&link_sel) {
        let href = el.value().attr("href").unwrap_or("");
        let Some(ep_no) = extract_episode_no(href) else { continue };
        if seen_ep.contains(&ep_no) {
            continue;
        }
        seen_ep.push(ep_no);

        let title = el
            .select(&img_sel)
            .next()
            .and_then(|img| img.value().attr("alt"))
            .map(collapse)
            .filter(|s| !s.is_empty())
            .or_else(|| {
                el.select(&subj_sel).next().and_then(|s| {
                    s.select(&inner_span_sel)
                        .next()
                        .map(|n| collapse(&n.text().collect::<String>()))
                        .filter(|t| !t.is_empty())
                        .or_else(|| {
                            let t = collapse(&s.text().collect::<String>());
                            if t.is_empty() {
                                None
                            } else {
                                Some(t)
                            }
                        })
                })
            })
            .unwrap_or_else(|| format!("第 {} 话", ep_no));

        chapters.push(Chapter {
            index: ep_no as f64,
            title,
            pages: Vec::new(),
            downloaded: false,
            read: false,
        });
    }
    chapters.sort_by(|a, b| b.index.partial_cmp(&a.index).unwrap_or(std::cmp::Ordering::Equal));

    let mut detail = Detail {
        comic,
        chapters,
    };
    detail.comic.last_chapter = detail
        .chapters
        .first()
        .map(|c| c.title.clone())
        .unwrap_or_default();
    detail
}

fn detail(title_no: &str) -> Option<Detail> {
    let series_url = {
        let cache = SERIES_URL_CACHE.lock().unwrap();
        cache
            .get(title_no)
            .cloned()
            .unwrap_or_else(|| format!("{}/any/list?title_no={}", BASE, title_no))
    };
    http::get_text(&series_url, &headers())
        .ok()
        .map(|html| parse_detail(&html, title_no))
}

pub fn parse_viewer(html: &str) -> Vec<String> {
    let document = Html::parse_document(html);
    document
        .select(&sel("img._images"))
        .filter_map(|e| e.value().attr("data-url"))
        .map(|s| s.to_string())
        .collect()
}

fn images(title_no: &str, episode_no: i64) -> Vec<String> {
    let series_url = SERIES_URL_CACHE.lock().unwrap().get(title_no).cloned();
    let path = match series_url.as_deref().and_then(slug_from_series_url) {
        Some(slug) => format!(
            "{}/{}/episode-{}/viewer?title_no={}&episode_no={}",
            BASE, slug, episode_no, title_no, episode_no
        ),
        None => format!(
            "{}/any/episode-{}/viewer?title_no={}&episode_no={}",
            BASE, episode_no, title_no, episode_no
        ),
    };
    let referer = series_url.unwrap_or_else(|| format!("{}/any/list?title_no={}", BASE, title_no));
    let mut hs = headers();
    hs.push(("Referer", referer.as_str()));
    http::get_text(&path, &hs)
        .map(|html| parse_viewer(&html))
        .unwrap_or_default()
}

fn hydrate(payload: &Value) -> String {
    if let Some(map) = payload.as_object() {
        let mut cache = SERIES_URL_CACHE.lock().unwrap();
        for (k, v) in map {
            if let Some(url) = v.as_str() {
                if !cache.contains_key(k) {
                    cache.insert(k.clone(), url.to_string());
                }
            }
        }
    }
    "true".into()
}
