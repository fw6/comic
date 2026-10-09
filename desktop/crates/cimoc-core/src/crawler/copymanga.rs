//! Copymanga 拷贝漫画 图源（脚本源，2026-08-18 新增）。
//! 解析与 op URL 构造在源脚本 `js/sources/copymanga.js`；本模块保留 Rust 侧职责：
//! 网络请求头、章节 feed（detail 的 ctx 与 images 的 chapterUuid 共用）。
//! 章节在 `/group/{group}/chapters` 独立端点（不在 comic2 响应里），取默认「正序」组。

use crate::crawler::http;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

pub const API: &str = "https://api.mangacopy.com";
pub const PREFIX: &str = "copymanga-";
/// 单次拉取章节数上限（超长连载会截断，v1 够用）。
const FEED_LIMIT: &str = "1000";

/// 章节 uuid 缓存：path_word -> [{index, uuid}]（images 复用详情已拉取的 feed）。
static CHAPTER_ID_CACHE: LazyLock<Mutex<HashMap<String, Vec<(f64, String)>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// API 请求头：platform/version/hc-lang 为 Copymanga 客户端标识（缺省触发 code 210 风控）。
pub fn headers() -> Vec<(&'static str, &'static str)> {
    vec![
        ("User-Agent", "Cimoc/1.0"),
        ("Accept", "application/json"),
        ("platform", "3"),
        ("version", "3.0.0"),
        ("hc-lang", "zh-hans"),
    ]
}

fn get_json(url: &str) -> Result<Value, String> {
    http::get_json(url, &headers())
}

/// 拉取章节 feed（默认正序组；返回 results.list，空/失败返回空 Vec）。
pub fn feed(path_word: &str) -> Vec<Value> {
    feed_with_base(API, path_word)
}

/// feed 的 base 可注入版（测试打本地 mock；生产恒走 API）。
fn feed_with_base(base: &str, path_word: &str) -> Vec<Value> {
    let url = format!(
        "{base}/api/v3/comic/{path_word}/group/default/chapters?limit={FEED_LIMIT}&offset=0"
    );
    get_json(&url)
        .ok()
        .and_then(|j| j.get("results").and_then(|r| r.get("list")).cloned())
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
}

/// path_word -> [{index, uuid}]（与脚本 toChapters 相同去重，保留首个，但保留 uuid）。
fn chapter_id_list(feed: &[Value]) -> Vec<(f64, String)> {
    let mut seen: Vec<f64> = Vec::new();
    let mut list = Vec::new();
    for ch in feed {
        let Some(num) = chapter_num(ch) else { continue };
        if seen.contains(&num) {
            continue;
        }
        seen.push(num);
        let id = ch.get("uuid").and_then(|v| v.as_str()).unwrap_or("");
        list.push((num, id.to_string()));
    }
    list
}

/// 章节号：string 或 number，非有限数返回 None。
fn chapter_num(ch: &Value) -> Option<f64> {
    let v = ch.get("index")?;
    if let Some(s) = v.as_str() {
        s.parse::<f64>().ok().filter(|n| n.is_finite())
    } else {
        v.as_f64().filter(|n| n.is_finite())
    }
}

/// chapterIndex -> uuid（images 的 ctx；feed 拉取/缓存失败或未找到返回 None）。
pub fn chapter_id_for(path_word: &str, index: f64) -> Option<String> {
    chapter_id_for_with_base(API, path_word, index)
}

/// chapter_id_for 的 base 可注入版（测试打本地 mock；生产恒走 API）。
fn chapter_id_for_with_base(base: &str, path_word: &str, index: f64) -> Option<String> {
    let list = {
        let cache = CHAPTER_ID_CACHE.lock().unwrap();
        match cache.get(path_word) {
            Some(list) => list.clone(),
            None => {
                drop(cache);
                let list = chapter_id_list(&feed_with_base(base, path_word));
                CHAPTER_ID_CACHE
                    .lock()
                    .unwrap()
                    .insert(path_word.to_string(), list.clone());
                list
            }
        }
    };
    list.iter().find(|(idx, _)| *idx == index).map(|(_, id)| id.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    #[test]
    fn chapter_list_dedupes_and_keeps_first_uuid() {
        let feed: Vec<Value> = serde_json::from_str(
            r#"[
                {"index": 1, "uuid": "ch-1"},
                {"index": 2, "uuid": "ch-2"},
                {"index": 1, "uuid": "ch-1-dup"}
            ]"#,
        )
        .unwrap();
        let list = chapter_id_list(&feed);
        assert_eq!(list, vec![(1.0, "ch-1".to_string()), (2.0, "ch-2".to_string())]);
    }

    #[test]
    fn chapter_num_parses_number_and_string() {
        let ch: Value = serde_json::json!({"index": 3});
        assert_eq!(chapter_num(&ch), Some(3.0));
        let ch: Value = serde_json::json!({"index": "1.5"});
        assert_eq!(chapter_num(&ch), Some(1.5));
        let ch: Value = serde_json::json!({"index": null});
        assert_eq!(chapter_num(&ch), None);
    }

    /// 极简本地 HTTP 服务：循环 accept，断言请求行，回固定 JSON（模拟 copymanga 章节端点）。
    fn spawn_mock(assert_path: &'static str, body: &'static str) -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { break };
                let mut buf = [0u8; 8192];
                let n = stream.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]).to_string();
                // 确认 URL 构造与请求头（platform/version/hc-lang 齐备）
                assert!(req.contains(assert_path), "req 应含 {assert_path}: {req}");
                assert!(req.contains("platform: 3"));
                assert!(req.contains("version: 3.0.0"));
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(resp.as_bytes());
                let _ = stream.flush();
            }
        });
        port
    }

    /// feed 真网路径集成：URL 构造 → 抓取 → results.list 提取；chapter_id_for 命中缓存。
    #[test]
    fn feed_and_chapter_id_for_hit_mock_api() {
        const FEED_BODY: &str = r#"{"code":200,"message":"请求成功","results":{"limit":1000,"offset":0,"total":3,"list":[
            {"index":1,"uuid":"ch-1","name":"第 1 话","group_path_word":"default"},
            {"index":2,"uuid":"ch-2","name":"第 2 话","group_path_word":"default"},
            {"index":3,"uuid":"ch-3","name":"第 3 话","group_path_word":"default"}
        ]}}"#;
        let port = spawn_mock(
            "/api/v3/comic/mockcomic/group/default/chapters?limit=1000&offset=0",
            FEED_BODY,
        );
        let base = format!("http://127.0.0.1:{port}");

        let feed = feed_with_base(&base, "mockcomic");
        assert_eq!(feed.len(), 3);
        assert_eq!(feed[1]["name"], "第 2 话");

        // 首次调用拉取 + 缓存，命中 index=2 → ch-2
        assert_eq!(chapter_id_for_with_base(&base, "mockcomic", 2.0).as_deref(), Some("ch-2"));
        // 未找到的 index → None（命中缓存，不再发请求）
        assert_eq!(chapter_id_for_with_base(&base, "mockcomic", 99.0), None);
    }

    /// feed 失败（如 HTTP 非 200 / 无 results.list）→ 空 Vec，不 panic。
    #[test]
    fn feed_handles_bad_response_gracefully() {
        let port = spawn_mock("/api/v3/comic/boomcomic/group/default/chapters", r#"{"code":500}"#);
        let base = format!("http://127.0.0.1:{port}");
        assert!(feed_with_base(&base, "boomcomic").is_empty());
    }
}
