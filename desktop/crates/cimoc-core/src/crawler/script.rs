//! 脚本源执行器：buildUrl → 抓取 → parse → 后处理（wayfinder #15/#16/#17 定案）。
//!
//! 网络/请求头/缓存驻留 Rust（grilling #11）：脚本只负责 URL 构造与解析；
//! Rust 侧经 ctx 提供缓存派生值（webtoons seriesUrl、mangadex tagId/chapterId/feed）。

use crate::crawler::http;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

/// 最近一次源错误（source -> (message, unix_ms)），供前端错误行/日志（#17）。
static LAST_ERROR: LazyLock<Mutex<HashMap<String, (String, u64)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 记录该源最近一次错误（覆盖旧值）。
pub fn record_error(source: &str, message: &str) {
    LAST_ERROR
        .lock()
        .unwrap()
        .insert(source.to_string(), (message.to_string(), now_ms()));
}

/// op 成功时清除该源最近错误（Sources 错误行不显示陈旧错误）。
pub fn clear_error(source: &str) {
    LAST_ERROR.lock().unwrap().remove(source);
}

/// 读取（不清空）最近错误。
pub fn last_error(source: &str) -> Option<(String, u64)> {
    LAST_ERROR.lock().unwrap().get(source).cloned()
}

/// 全部源的最近错误（命令层展示用）。
pub fn all_errors() -> HashMap<String, (String, u64)> {
    LAST_ERROR.lock().unwrap().clone()
}

/// 跑一个脚本源 op：buildUrl →（抓取）→ parse → 后处理。失败按协议返回空 JSON 并记录错误。
pub fn run(op: &str, source: &str, payload: &str, script: &str) -> String {
    let payload_val: Value = serde_json::from_str(payload).unwrap_or(Value::Null);
    let ctx = build_ctx(source, op, &payload_val);
    let url = match crate::js::call(script, "buildUrl", op, payload, &ctx) {
        Ok(u) => u,
        Err(e) => {
            record_error(source, &format!("buildUrl({op}): {e}"));
            return empty_for(op);
        }
    };
    // categories 无 URL：脚本静态输出，跳过抓取；其余 op 空 URL = 无可抓取（按空结果返回）。
    let input = if url.is_empty() && op == "categories" {
        String::new()
    } else if url.is_empty() {
        return empty_for(op);
    } else {
        match fetch(source, op, &url, &ctx) {
            Ok(s) => s,
            Err(e) => {
                record_error(source, &format!("fetch({op}): {e}"));
                return empty_for(op);
            }
        }
    };
    match crate::js::call(script, "parse", op, &input, &ctx) {
        Ok(json) => {
            let out = post_process(source, op, &json);
            clear_error(source);
            out
        }
        Err(e) => {
            record_error(source, &format!("parse({op}): {e}"));
            empty_for(op)
        }
    }
}

/// 抓取原始响应体（HTML 或 JSON 文本）；请求头按源/op（图片 op 带 Referer）。
fn fetch(source: &str, op: &str, url: &str, ctx: &str) -> Result<String, String> {
    match source {
        "webtoons" => {
            let base: Vec<(&str, &str)> = crate::crawler::webtoons::headers();
            if op != "images" {
                return http::get_text(url, &base);
            }
            let c: Value = serde_json::from_str(ctx).unwrap_or(Value::Null);
            let title_no = c
                .get("titleNo")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let referer: String = match c
                .get("seriesUrl")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
            {
                Some(s) => s.to_string(),
                None => format!(
                    "{}/any/list?title_no={}",
                    crate::crawler::webtoons::BASE,
                    title_no
                ),
            };
            let mut hs = Vec::with_capacity(base.len() + 1);
            for (k, v) in base {
                hs.push((k, v));
            }
            hs.push(("Referer", referer.as_str()));
            http::get_text(url, &hs)
        }
        "mangadex" => http::get_text(url, &crate::crawler::mangadex::headers()),
        "copymanga" => http::get_text(url, &crate::crawler::copymanga::headers()),
        "dongman" => http::get_text(url, &crate::crawler::dongman::headers()),
        "manhuagui" => http::get_text(url, &crate::crawler::manhuagui::headers()),
        _ => Err("未知 source".into()),
    }
}

/// 构建 op 上下文：缓存/网络派生的值经 ctx 交给脚本（URL 构造与解析所需）。
fn build_ctx(source: &str, op: &str, payload: &Value) -> String {
    match source {
        "webtoons" => {
            let title_no = payload
                .get("comicId")
                .and_then(|v| v.as_str())
                .and_then(|id| id.strip_prefix(crate::crawler::webtoons::WEBTOONS_PREFIX))
                .unwrap_or("")
                .to_string();
            match op {
                "detail" | "images" => serde_json::json!({
                    "seriesUrl": crate::crawler::webtoons::cached_series_url(&title_no).unwrap_or_default(),
                    "titleNo": title_no,
                })
                .to_string(),
                _ => "{}".to_string(),
            }
        }
        "mangadex" => {
            let manga_id = payload
                .get("comicId")
                .and_then(|v| v.as_str())
                .and_then(|id| id.strip_prefix(crate::crawler::mangadex::MANGA_PREFIX))
                .unwrap_or("")
                .to_string();
            match op {
                "category" => {
                    let label = payload.get("label").and_then(|v| v.as_str()).unwrap_or("");
                    serde_json::json!({
                        "label": label,
                        "tagId": crate::crawler::mangadex::tag_id_for(label),
                    })
                    .to_string()
                }
                "detail" => {
                    let feed = crate::crawler::mangadex::fetch_feed(&manga_id).unwrap_or_default();
                    serde_json::json!({ "feed": feed }).to_string()
                }
                "images" => {
                    let idx = payload
                        .get("chapterIndex")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0);
                    serde_json::json!({
                        "chapterId": crate::crawler::mangadex::chapter_id_for(&manga_id, idx),
                    })
                    .to_string()
                }
                _ => "{}".to_string(),
            }
        }
        "copymanga" => {
            let path = payload
                .get("comicId")
                .and_then(|v| v.as_str())
                .and_then(|id| id.strip_prefix(crate::crawler::copymanga::PREFIX))
                .unwrap_or("")
                .to_string();
            match op {
                "detail" => {
                    let feed = crate::crawler::copymanga::feed(&path);
                    serde_json::json!({ "feed": feed }).to_string()
                }
                "images" => {
                    let idx = payload
                        .get("chapterIndex")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0);
                    serde_json::json!({
                        "chapterUuid": crate::crawler::copymanga::chapter_id_for(&path, idx),
                    })
                    .to_string()
                }
                _ => "{}".to_string(),
            }
        }
        "dongman" => {
            let title_no = payload
                .get("comicId")
                .and_then(|v| v.as_str())
                .and_then(|id| id.strip_prefix(crate::crawler::dongman::PREFIX))
                .unwrap_or("")
                .to_string();
            match op {
                "images" => {
                    let idx = payload
                        .get("chapterIndex")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0);
                    serde_json::json!({
                        "viewerUrl": crate::crawler::dongman::viewer_url_for(&title_no, idx),
                    })
                    .to_string()
                }
                "detail" => serde_json::json!({ "titleNo": title_no }).to_string(),
                _ => "{}".to_string(),
            }
        }
        "manhuagui" => {
            // detail 解析需按 /comic/{id}/ 过滤本漫画章节（同类推荐的其它漫画链接不进来）
            let id = payload
                .get("comicId")
                .and_then(|v| v.as_str())
                .and_then(|v| v.strip_prefix(crate::crawler::manhuagui::PREFIX))
                .unwrap_or("")
                .to_string();
            match op {
                "detail" => serde_json::json!({ "comicId": id }).to_string(),
                _ => "{}".to_string(),
            }
        }
        _ => "{}".to_string(),
    }
}

/// 后处理：webtoons search/category 把列表项的隐藏 seriesUrl 提取进系列 URL 缓存并剥离
/// （前端契约不变，缓存供 detail/images 的 URL 构造）。
fn post_process(source: &str, op: &str, json: &str) -> String {
    if source != "webtoons" || (op != "search" && op != "category") {
        return json.to_string();
    }
    let mut v: Value = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => return json.to_string(),
    };
    if let Some(arr) = v.as_array_mut() {
        for item in arr.iter_mut() {
            if let Some(obj) = item.as_object_mut() {
                let series = obj
                    .remove("seriesUrl")
                    .and_then(|u| u.as_str().map(String::from));
                if let Some(url) = series {
                    if let Some(id) = obj.get("id").and_then(|i| i.as_str()) {
                        if let Some(title_no) = id.strip_prefix(crate::crawler::webtoons::WEBTOONS_PREFIX)
                        {
                            crate::crawler::webtoons::cache_series_url(title_no, &url);
                        }
                    }
                }
            }
        }
    }
    v.to_string()
}

fn empty_for(op: &str) -> String {
    if op == "detail" {
        "{}".into()
    } else {
        "[]".into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn webtoons_series_url_extracted_and_cached() {
        let json = r#"[
            {"id":"webtoons-1571","title":"Eleceed","seriesUrl":"https://www.webtoons.com/en/action/eleceed/list?title_no=1571"},
            {"id":"webtoons-42","title":"X"}
        ]"#;
        let out = post_process("webtoons", "search", json);
        let v: Value = serde_json::from_str(&out).unwrap();
        // seriesUrl 被剥离，字段不泄漏给前端
        assert!(v[0].get("seriesUrl").is_none());
        assert!(v[0].get("title").is_some());
        // 提取入缓存，供 detail/images 的 ctx
        assert_eq!(
            crate::crawler::webtoons::cached_series_url("1571").as_deref(),
            Some("https://www.webtoons.com/en/action/eleceed/list?title_no=1571")
        );
        // 无 seriesUrl 的项不报错
        assert!(v[1].get("seriesUrl").is_none());
    }

    #[test]
    fn non_webtoons_passthrough() {
        let json = r#"[{"id":"mangadex-x","title":"Y"}]"#;
        assert_eq!(post_process("mangadex", "search", json), json);
    }

    #[test]
    fn error_registry_records_and_reads() {
        record_error("webtoons", "parse(search): boom");
        let (msg, at) = last_error("webtoons").unwrap();
        assert!(msg.contains("boom"));
        assert!(at > 0);
        assert!(last_error("mangadex").is_none());
    }
}
