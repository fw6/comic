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
//!
//! 结果缓存（`result_cache`）：列表/详情类 op 的成功结果写入内存 LRU + 磁盘
//! （cache_dir 为空表示禁用），供 `cached_result` 读取（前端 stale-while-revalidate 的
//! stale 一侧）；失败结果不写入。

pub mod baozimh;
pub mod copymanga;
pub mod dongman;
pub mod hentara;
pub mod http;
pub mod kxmanhua;
pub mod mangadex;
pub mod manhuagui;
pub mod models;
pub mod render;
pub mod result_cache;
pub mod script;
pub mod webtoons;

use serde_json::Value;

use script::clear_error;

/// 分发并返回 JSON 字符串。未知 source/op 按列表类返回 `[]`。
/// `script`：该 source 的运行时脚本（src-tauri 从 sources.json 同步进来）；缓存类 op 忽略。
/// `cache_dir`：结果缓存目录（空串禁用）；成功结果在此留一份供 `cached_result` 读取。
pub fn crawl(op: &str, source: &str, payload: &str, script: &str, cache_dir: &str) -> String {
    let (out, ok) = dispatch(op, source, payload, script);
    if ok {
        result_cache::put(cache_dir, source, op, payload, script, &out);
    }
    out
}

/// 读取缓存的抓取结果（不触发网络）。命中返回 `{"data": <结果>, "fetchedAt": <unix_ms>}`，
/// 未命中返回 `null`。命中视为该源有可用数据，清掉陈旧的错误行（与 crawl 的成功上报一致）。
pub fn cached_result(op: &str, source: &str, payload: &str, script: &str, cache_dir: &str) -> String {
    let Some((data, at)) = result_cache::get(cache_dir, source, op, payload, script) else {
        return "null".into();
    };
    let Ok(value) = serde_json::from_str::<Value>(&data) else {
        return "null".into();
    };
    clear_error(source);
    serde_json::json!({ "data": value, "fetchedAt": at }).to_string()
}

/// 分派到各源实现。第二个返回值表示本次结果是否成功（供结果缓存判定；空 URL / 未知
/// source 等不可缓存的情况返回 false）。
fn dispatch(op: &str, source: &str, payload: &str, script: &str) -> (String, bool) {
    match source {
        "webtoons" => match op {
            "cache_dump" | "cache_hydrate" => (webtoons::cache_op(op, payload), true),
            _ if !script.is_empty() => script::run(op, source, payload, script),
            _ => ("[]".into(), false),
        },
        "mangadex" => match op {
            "categories" => match mangadex::categories() {
                Ok(cats) => (
                    serde_json::to_string(&cats).unwrap_or_else(|_| "[]".into()),
                    true,
                ),
                Err(_) => ("[]".into(), false),
            },
            _ if !script.is_empty() => script::run(op, source, payload, script),
            _ => ("[]".into(), false),
        },
        // 纯脚本源：op 全交运行时脚本（nnhanman 的抓取经渲染通道，见 script::fetch）
        "copymanga" | "dongman" | "manhuagui" | "baozimh" | "nnhanman" | "kxmanhua"
        | "hentara" => match op {
            _ if !script.is_empty() => script::run(op, source, payload, script),
            _ => ("[]".into(), false),
        },
        _ => ("[]".into(), false),
    }
}
