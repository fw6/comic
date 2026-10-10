//! Webtoons 源适配器。
//!
//! 解析与 op URL 构造在源脚本 `js/sources/webtoons.js`；Rust 侧提供网络请求头（images
//! 按 ctx 的 seriesUrl 带 Referer）、系列 URL 缓存（含 cache_dump/cache_hydrate 持久化）
//! 与列表项隐藏字段 seriesUrl 的提取。

use super::{comic_id, ErrorSlot, HotlinkReferer, Source};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

/// 站点根（seriesUrl 缺省时的详情页地址）。
const BASE: &str = "https://www.webtoons.com/en";
/// 漫画 id 前缀。
const PREFIX: &str = "webtoons-";

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

pub static WEBTOONS: Webtoons = Webtoons;
pub struct Webtoons;

static ERROR: ErrorSlot = ErrorSlot::new();

/// 系列 URL 缓存（含 genre slug）：titleNo -> 详情页 URL，跨会话经 cache_dump/hydrate 持久化。
static SERIES_URL_CACHE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 读取缓存的系列 URL（detail/images 的 ctx，脚本据此构造请求 URL）。
fn cached_series_url(title_no: &str) -> Option<String> {
    SERIES_URL_CACHE.lock().unwrap().get(title_no).cloned()
}

/// 只在缺失时填入（hydrate/列表解析的填入语义，已有值不覆盖）。
fn cache_series_url(title_no: &str, url: &str) {
    let mut cache = SERIES_URL_CACHE.lock().unwrap();
    if !cache.contains_key(title_no) {
        cache.insert(title_no.to_string(), url.to_string());
    }
}

/// cache_dump / cache_hydrate（前端持久化 webtoons-cache.json；不经脚本）。
fn cache_op(op: &str, payload: &str) -> String {
    match op {
        "cache_dump" => serde_json::to_string(&*SERIES_URL_CACHE.lock().unwrap())
            .unwrap_or_else(|_| "{}".into()),
        "cache_hydrate" => {
            if let Ok(map) = serde_json::from_str::<Value>(payload) {
                if let Some(obj) = map.as_object() {
                    for (k, v) in obj {
                        if let Some(url) = v.as_str() {
                            cache_series_url(k, url);
                        }
                    }
                }
            }
            "true".into()
        }
        _ => "{}".into(),
    }
}

impl Source for Webtoons {
    fn title(&self) -> &'static str {
        "Webtoons"
    }

    fn script(&self) -> &'static str {
        include_str!("../../js/sources/webtoons.js")
    }

    fn headers(&self, op: &str, ctx: &Value) -> Vec<(&'static str, String)> {
        let mut headers: Vec<(&'static str, String)> = UA_HEADERS
            .iter()
            .map(|(k, v)| (*k, v.to_string()))
            .collect();
        if op != "images" {
            return headers;
        }
        let title_no = ctx
            .get("titleNo")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let referer = ctx
            .get("seriesUrl")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from)
            .unwrap_or_else(|| format!("{BASE}/any/list?title_no={title_no}"));
        headers.push(("Referer", referer));
        headers
    }

    fn ctx(&self, op: &str, payload: &Value) -> Value {
        let title_no = comic_id(payload).strip_prefix(PREFIX).unwrap_or("");
        match op {
            "detail" | "images" => json!({
                "seriesUrl": cached_series_url(title_no).unwrap_or_default(),
                "titleNo": title_no,
            }),
            _ => json!({}),
        }
    }

    fn native_op(&self, op: &str, payload: &Value) -> Option<(String, bool)> {
        matches!(op, "cache_dump" | "cache_hydrate")
            .then(|| (cache_op(op, &payload.to_string()), true))
    }

    /// search/category 把列表项的隐藏 seriesUrl 提取进缓存并剥离（前端契约不变，
    /// 缓存供 detail/images 的 URL 构造）。
    fn post_process(&self, op: &str, json: &str) -> String {
        if op != "search" && op != "category" {
            return json.to_string();
        }
        let mut v: Value = match serde_json::from_str(json) {
            Ok(v) => v,
            Err(_) => return json.to_string(),
        };
        if let Some(arr) = v.as_array_mut() {
            for item in arr.iter_mut() {
                let Some(obj) = item.as_object_mut() else {
                    continue;
                };
                let series = obj
                    .remove("seriesUrl")
                    .and_then(|u| u.as_str().map(String::from));
                let Some(url) = series else { continue };
                let Some(title_no) = obj
                    .get("id")
                    .and_then(|i| i.as_str())
                    .and_then(|id| id.strip_prefix(PREFIX))
                else {
                    continue;
                };
                cache_series_url(title_no, &url);
            }
        }
        v.to_string()
    }

    fn hotlink_referers(&self) -> &'static [HotlinkReferer] {
        &[HotlinkReferer {
            domain: "pstatic.net",
            referer: "https://www.webtoons.com/",
        }]
    }

    fn errors(&self) -> &'static ErrorSlot {
        &ERROR
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx_of(op: &str, payload: Value) -> Value {
        WEBTOONS.ctx(op, &payload)
    }

    /// 列表解析把 seriesUrl 提取进缓存并从结果里剥离。
    #[test]
    fn series_url_extracted_and_cached() {
        let json = r#"[
            {"id":"webtoons-1571","title":"Eleceed","seriesUrl":"https://www.webtoons.com/en/action/eleceed/list?title_no=1571"},
            {"id":"webtoons-42","title":"X"}
        ]"#;
        let out = WEBTOONS.post_process("search", json);
        let v: Value = serde_json::from_str(&out).unwrap();
        assert!(v[0].get("seriesUrl").is_none());
        assert!(v[0].get("title").is_some());
        assert!(v[1].get("seriesUrl").is_none());
        // 缓存供 detail/images 的 ctx 使用
        assert_eq!(
            cached_series_url("1571").as_deref(),
            Some("https://www.webtoons.com/en/action/eleceed/list?title_no=1571")
        );
    }

    /// detail/images 的 ctx 带 seriesUrl 与 titleNo（comicId 前缀被剥掉）。
    #[test]
    fn ctx_carries_series_url_and_title_no() {
        cache_series_url("1571", "https://www.webtoons.com/en/action/eleceed/list?title_no=1571");
        let payload = json!({"comicId": "webtoons-1571"});
        let ctx = ctx_of("detail", payload.clone());
        assert_eq!(ctx["titleNo"], "1571");
        assert_eq!(
            ctx["seriesUrl"],
            "https://www.webtoons.com/en/action/eleceed/list?title_no=1571"
        );
        // 其它 op 不派生
        assert_eq!(ctx_of("search", payload.clone()), json!({}));
        assert_eq!(ctx_of("categories", payload), json!({}));
    }

    /// images 的请求头在基础 UA 之上按 ctx 补 Referer。
    #[test]
    fn images_headers_carry_referer() {
        let ctx = json!({"seriesUrl": "https://www.webtoons.com/en/action/eleceed/list?title_no=1571", "titleNo": "1571"});
        let hs = WEBTOONS.headers("images", &ctx);
        assert_eq!(hs.len(), 4);
        assert_eq!(
            hs[3],
            (
                "Referer",
                "https://www.webtoons.com/en/action/eleceed/list?title_no=1571".to_string()
            )
        );
        // 其它 op 只有基础头
        assert_eq!(WEBTOONS.headers("detail", &ctx).len(), 3);
    }

    /// seriesUrl 缺失时 images 的 Referer 回退到详情页地址。
    #[test]
    fn images_referer_falls_back_to_detail_page() {
        let hs = WEBTOONS.headers("images", &json!({"seriesUrl": "", "titleNo": "42"}));
        assert_eq!(
            hs[3],
            (
                "Referer",
                "https://www.webtoons.com/en/any/list?title_no=42".to_string()
            )
        );
    }

    /// cache_dump / cache_hydrate 是 Rust 直连 op，往返保住系列 URL 缓存。
    #[test]
    fn cache_op_round_trips() {
        cache_series_url("9001", "https://www.webtoons.com/en/action/x/list?title_no=9001");
        let dump = WEBTOONS.native_op("cache_dump", &json!({})).unwrap();
        assert!(dump.0.contains("9001"));
        assert!(dump.1);
        assert_eq!(WEBTOONS.native_op("detail", &json!({})), None);
    }

    /// 非 webtoons 的 op 与坏 JSON 原样返回。
    #[test]
    fn post_process_passes_through_others() {
        let json = r#"[{"id":"mangadex-x","title":"Y"}]"#;
        assert_eq!(WEBTOONS.post_process("detail", json), json);
        assert_eq!(WEBTOONS.post_process("search", "not json"), "not json");
    }
}
