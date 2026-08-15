//! Webtoons 图源（脚本源，wayfinder #11/#15/#16 定案）。
//! 解析与 op URL 构造在源脚本 `js/sources/webtoons.js`；本模块保留 Rust 侧职责：
//! 网络请求头、系列 URL 缓存（含 cache_dump/cache_hydrate 持久化，grilling #6）。

use serde_json::Value;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

pub const BASE: &str = "https://www.webtoons.com/en";
pub const WEBTOONS_PREFIX: &str = "webtoons-";

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

/// 系列 URL 缓存（含 genre slug）：titleNo -> 详情页 URL，跨会话经 cache_dump/hydrate 持久化。
static SERIES_URL_CACHE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn headers() -> Vec<(&'static str, &'static str)> {
    UA_HEADERS.to_vec()
}

/// 读取缓存的系列 URL（detail/images 的 ctx，脚本据此构造请求 URL）。
pub fn cached_series_url(title_no: &str) -> Option<String> {
    SERIES_URL_CACHE.lock().unwrap().get(title_no).cloned()
}

/// 只在缺失时填入（hydrate/列表解析的填入语义，已有值不覆盖）。
pub fn cache_series_url(title_no: &str, url: &str) {
    let mut cache = SERIES_URL_CACHE.lock().unwrap();
    if !cache.contains_key(title_no) {
        cache.insert(title_no.to_string(), url.to_string());
    }
}

/// cache_dump / cache_hydrate（前端 webtoons-cache.json 持久化，grilling #6；不经脚本）。
pub fn cache_op(op: &str, payload: &str) -> String {
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
