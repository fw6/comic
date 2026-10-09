//! 咚漫（中文 Webtoon）图源（脚本源，2026-08-19 新增）。
//! 解析与 op URL 构造在源脚本 `js/sources/dongman.js`；本模块保留 Rust 侧职责：
//! 章节 viewer URL 缓存（images 的 ctx），取数经 `crawler::fetch`。
//! 详情页章节的 viewer URL 含不可重建的章节 slug，由 Rust 从详情页提取后经
//! ctx.viewerUrl 交给脚本——cache miss 时拉一次详情页（/episodeList?titleNo=N，
//! 301 到规范页，导航自动跟随）。

use scraper::{Html, Selector};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

pub const API: &str = "https://www.dongmanmanhua.cn";
pub const PREFIX: &str = "dongman-";

/// 章节 viewer URL 缓存：title_no -> [(episode_no, viewer_url)]（images 复用详情已拉取）。
static VIEWER_CACHE: LazyLock<Mutex<HashMap<String, Vec<(f64, String)>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// chapterIndex（= episode_no）-> viewer URL（images 的 ctx；抓取/缓存失败或未找到返回 None）。
pub fn viewer_url_for(title_no: &str, episode_no: f64) -> Option<String> {
    viewer_url_for_with(&|url| super::fetch("dongman", url), title_no, episode_no)
}

/// viewer_url_for 的取数可注入版（测试注入 fixture；生产恒走渲染通道）。
fn viewer_url_for_with(
    fetch: &dyn Fn(&str) -> Result<String, String>,
    title_no: &str,
    episode_no: f64,
) -> Option<String> {
    let list = {
        let cache = VIEWER_CACHE.lock().unwrap();
        match cache.get(title_no) {
            Some(list) => list.clone(),
            None => {
                drop(cache);
                let url = format!("{API}/episodeList?titleNo={title_no}");
                let list = fetch(&url)
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
    let digits: String = rest
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    digits.parse::<f64>().ok()
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

    /// fixture 注入取数：详情页 HTML → viewer_url_for 命中缓存，且不重复取数。
    #[test]
    fn viewer_url_for_parses_detail_and_caches() {
        let detail = r#"<html><ul id="_listUl">
            <li id="episode_2" data-episode-no="2"><a href="//www.dongmanmanhua.cn/BOY/x/ep-2/viewer?title_no=777&episode_no=2">2</a></li>
        </ul></html>"#;
        let calls = std::cell::Cell::new(0);
        let fetch = |_url: &str| {
            calls.set(calls.get() + 1);
            Ok(detail.to_string())
        };
        let url = viewer_url_for_with(&fetch, "777", 2.0);
        assert_eq!(
            url.as_deref(),
            Some("https://www.dongmanmanhua.cn/BOY/x/ep-2/viewer?title_no=777&episode_no=2")
        );
        // 未找到的 episode_no → None（命中缓存，不再取数）
        assert_eq!(viewer_url_for_with(&fetch, "777", 99.0), None);
        assert_eq!(calls.get(), 1);
    }

    #[test]
    fn viewer_url_for_bad_response_returns_none() {
        let fetch = |_url: &str| Err("HTTP 500".to_string());
        assert_eq!(viewer_url_for_with(&fetch, "999", 1.0), None);
    }
}
