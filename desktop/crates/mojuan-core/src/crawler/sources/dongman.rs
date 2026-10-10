//! 咚漫（中文 Webtoon）源适配器。
//!
//! 解析与 op URL 构造在源脚本 `js/sources/dongman.js`；Rust 侧提供网络请求头与章节
//! viewer URL 缓存（images 的 ctx）。详情页章节的 viewer URL 含不可重建的章节 slug，
//! 由 Rust 从详情页提取后经 ctx.viewerUrl 交给脚本——cache miss 时拉一次详情页
//! （/episodeList?titleNo=N，301 到规范页，http 客户端自动跟随）。

use super::{chapter_index, comic_id, ErrorSlot, HotlinkReferer, Source};
use crate::crawler::http;
use scraper::{Html, Selector};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

const API: &str = "https://www.dongmanmanhua.cn";
/// 漫画 id 前缀。
const PREFIX: &str = "dongman-";

pub static DONGMAN: Dongman = Dongman;
pub struct Dongman;

static ERROR: ErrorSlot = ErrorSlot::new();

/// 章节 viewer URL 缓存：title_no -> [(episode_no, viewer_url)]（images 复用详情已拉取）。
static VIEWER_CACHE: LazyLock<Mutex<HashMap<String, Vec<(f64, String)>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 常规 HTML 请求头（移动站无风控，浏览器 UA 即可）。
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

/// chapterIndex（= episode_no）-> viewer URL（images 的 ctx；抓取/缓存失败或未找到返回 None）。
fn viewer_url_for(title_no: &str, episode_no: f64) -> Option<String> {
    viewer_url_for_with_base(API, title_no, episode_no)
}

/// viewer_url_for 的 base 可注入版（测试打本地 mock；生产恒走 API）。
fn viewer_url_for_with_base(base: &str, title_no: &str, episode_no: f64) -> Option<String> {
    let list = {
        let cache = VIEWER_CACHE.lock().unwrap();
        match cache.get(title_no) {
            Some(list) => list.clone(),
            None => {
                drop(cache);
                let url = format!("{base}/episodeList?titleNo={title_no}");
                let list = http::get_text(&url, &headers())
                    .ok()
                    .map(|h| chapter_viewer_urls(&h))
                    .unwrap_or_default();
                VIEWER_CACHE
                    .lock()
                    .unwrap()
                    .insert(title_no.to_string(), list.clone());
                list
            }
        }
    };
    list.iter()
        .find(|(idx, _)| *idx == episode_no)
        .map(|(_, u)| u.clone())
}

/// 详情页 HTML -> [(episode_no, viewer_url)]：取所有 `viewer?title_no=..&episode_no=..`
/// 链接（href 为 `//www.…` 相对协议，补 https:）。
fn chapter_viewer_urls(detail_html: &str) -> Vec<(f64, String)> {
    let doc = Html::parse_document(detail_html);
    let Ok(sel) = Selector::parse("a[href*='viewer?']") else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for a in doc.select(&sel) {
        let href = a.value().attr("href").unwrap_or("");
        if let Some(ep) = episode_no_from(href) {
            let url = if href.starts_with("//") {
                format!("https:{href}")
            } else {
                href.to_string()
            };
            out.push((ep, url));
        }
    }
    out
}

/// href 里 `episode_no=` 后的连续数字。
fn episode_no_from(href: &str) -> Option<f64> {
    let key = "episode_no=";
    let i = href.find(key)?;
    let rest = &href[i + key.len()..];
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse::<f64>().ok()
}

impl Source for Dongman {
    fn title(&self) -> &'static str {
        "咚漫"
    }

    fn script(&self) -> &'static str {
        include_str!("../../js/sources/dongman.js")
    }

    fn headers(&self, _op: &str, _ctx: &Value) -> Vec<(&'static str, String)> {
        headers()
            .into_iter()
            .map(|(k, v)| (k, v.to_string()))
            .collect()
    }

    fn ctx(&self, op: &str, payload: &Value) -> Value {
        let title_no = comic_id(payload).strip_prefix(PREFIX).unwrap_or("");
        match op {
            "images" => {
                json!({ "viewerUrl": viewer_url_for(title_no, chapter_index(payload)) })
            }
            "detail" => json!({ "titleNo": title_no }),
            _ => json!({}),
        }
    }

    fn hotlink_referers(&self) -> &'static [HotlinkReferer] {
        &[HotlinkReferer {
            domain: "dongmanmanhua.cn",
            referer: "https://www.dongmanmanhua.cn/",
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
    fn chapter_viewer_urls_extracts_and_normalizes_scheme() {
        let html = r#"<html><body>
            <ul id="_listUl">
                <li id="episode_10" data-episode-no="10">
                    <a href="//www.dongmanmanhua.cn/METROPOLIS/foo/ep-10/viewer?title_no=2859&episode_no=10">第10话</a>
                </li>
                <li id="episode_9" data-episode-no="9">
                    <a href="//www.dongmanmanhua.cn/METROPOLIS/foo/ep-9/viewer?title_no=2859&episode_no=9">第9话</a>
                </li>
            </ul>
        </body></html>"#;
        let list = chapter_viewer_urls(html);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].0, 10.0);
        assert_eq!(
            list[0].1,
            "https://www.dongmanmanhua.cn/METROPOLIS/foo/ep-10/viewer?title_no=2859&episode_no=10"
        );
        assert_eq!(list[1].0, 9.0);
    }

    #[test]
    fn episode_no_from_parses_digits() {
        assert_eq!(
            episode_no_from("//x/viewer?title_no=1&episode_no=398").unwrap(),
            398.0
        );
        assert_eq!(episode_no_from("//x/viewer?title_no=1"), None);
        assert_eq!(episode_no_from("//x/episode_no=abc"), None);
    }

    /// 本地 mock 详情页 → viewer_url_for 命中缓存，且不重复发请求。
    #[test]
    fn viewer_url_for_hits_mock_detail_page() {
        let detail = r#"<html><ul id="_listUl">
            <li id="episode_2" data-episode-no="2"><a href="//www.dongmanmanhua.cn/BOY/x/ep-2/viewer?title_no=777&episode_no=2">2</a></li>
        </ul></html>"#;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                use std::io::{Read, Write};
                let Ok(mut stream) = stream else { break };
                let mut buf = [0u8; 8192];
                let _ = stream.read(&mut buf).unwrap_or(0);
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    detail.len(),
                    detail
                );
                let _ = stream.write_all(resp.as_bytes());
                let _ = stream.flush();
            }
        });
        let base = format!("http://127.0.0.1:{port}");

        let url = viewer_url_for_with_base(&base, "777", 2.0);
        assert_eq!(
            url.as_deref(),
            Some("https://www.dongmanmanhua.cn/BOY/x/ep-2/viewer?title_no=777&episode_no=2")
        );
        // 未找到的 episode_no → None（命中缓存，不再发请求）
        assert_eq!(viewer_url_for_with_base(&base, "777", 99.0), None);
    }

    #[test]
    fn viewer_url_for_bad_response_returns_none() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            use std::io::{Read, Write};
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { break };
                let mut buf = [0u8; 8192];
                let _ = stream.read(&mut buf).unwrap_or(0);
                let resp = "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                let _ = stream.write_all(resp.as_bytes());
                let _ = stream.flush();
            }
        });
        let base = format!("http://127.0.0.1:{port}");
        assert_eq!(viewer_url_for_with_base(&base, "999", 1.0), None);
    }

    /// images 的 ctx 取缓存里的 viewerUrl；detail 的 ctx 只带 titleNo（前缀剥掉）。
    #[test]
    fn ctx_reads_cached_viewer_url_and_title_no() {
        VIEWER_CACHE.lock().unwrap().insert(
            "2859".to_string(),
            vec![(2.0, "https://www.dongmanmanhua.cn/BOY/x/ep-2/viewer?episode_no=2".to_string())],
        );
        let ctx = DONGMAN.ctx(
            "images",
            &json!({"comicId": "dongman-2859", "chapterIndex": 2}),
        );
        assert_eq!(
            ctx["viewerUrl"],
            "https://www.dongmanmanhua.cn/BOY/x/ep-2/viewer?episode_no=2"
        );
        // 缓存未命中的章节 → null
        let missing = DONGMAN.ctx(
            "images",
            &json!({"comicId": "dongman-2859", "chapterIndex": 99}),
        );
        assert!(missing["viewerUrl"].is_null());

        let detail = DONGMAN.ctx("detail", &json!({"comicId": "dongman-2859"}));
        assert_eq!(detail["titleNo"], "2859");
        assert_eq!(DONGMAN.ctx("search", &json!({})), json!({}));
    }
}
