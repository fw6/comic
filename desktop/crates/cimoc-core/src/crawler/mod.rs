//! 爬虫引擎统一入口：按 source 分派到图源实现（脚本源经 js 运行时，wayfinder #11/#15/#16 定案）。
//!
//! 协议（与 `cimoc.crawl` 方法一致，不变）：
//! - `op`：categories | search | category | detail | images | cache_dump | cache_hydrate
//! - `payload`：JSON 对象（serde_json::Value），各 op 读取自己的字段
//! - 返回值：JSON 字符串（列表 / 对象 / 数组），失败返回空 JSON（`[]` / `{}`）
//!
//! 源实现分派：webtoons/mangadex 为脚本源（解析/URL 构造在 js/sources/，经 `script` 传入
//! 运行时脚本）；webtoons 的 cache_dump/cache_hydrate 与 mangadex 的 categories 为 Rust 侧
//! 缓存/网络实现（不经脚本）。

pub mod http;
pub mod mangadex;
pub mod models;
pub mod script;
pub mod webtoons;

/// 分发并返回 JSON 字符串。未知 source/op 按列表类返回 `[]`。
/// `script`：该 source 的运行时脚本（src-tauri 从 sources.json 同步进来）；缓存类 op 忽略。
pub fn crawl(op: &str, source: &str, payload: &str, script: &str) -> String {
    match source {
        "webtoons" => match op {
            "cache_dump" | "cache_hydrate" => webtoons::cache_op(op, payload),
            _ if !script.is_empty() => script::run(op, source, payload, script),
            _ => "[]".into(),
        },
        "mangadex" => match op {
            "categories" => {
                serde_json::to_string(&mangadex::categories()).unwrap_or_else(|_| "[]".into())
            }
            _ if !script.is_empty() => script::run(op, source, payload, script),
            _ => "[]".into(),
        },
        _ => "[]".into(),
    }
}
