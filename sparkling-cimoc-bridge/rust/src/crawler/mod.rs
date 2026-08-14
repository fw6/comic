//! 爬虫引擎统一入口：按 source 分派到具体图源实现。
//!
//! 协议（与 `cimoc.crawl` 方法一致）：
//! - `op`：categories | search | category | detail | images | cache_dump | cache_hydrate
//! - `payload`：JSON 对象（serde_json::Value），各 op 读取自己的字段
//! - 返回值：JSON 字符串（列表 / 对象 / 数组），失败返回空 JSON（`[]` / `{}`）

pub mod http;
pub mod mangadex;
pub mod models;
pub mod webtoons;

use serde_json::Value;

/// 分发并返回 JSON 字符串。未知 source/op 按列表类返回 `[]`。
pub fn crawl(op: &str, source: &str, payload: &str) -> String {
    let payload: Value = serde_json::from_str(payload).unwrap_or(Value::Null);
    match source {
        "mangadex" => mangadex::crawl(op, &payload),
        "webtoons" => webtoons::crawl(op, &payload),
        _ => "[]".to_string(),
    }
}
