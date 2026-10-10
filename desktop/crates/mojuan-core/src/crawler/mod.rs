//! 爬虫引擎统一入口：按 source 分派到源 adapter（wayfinder #11/#15/#16 定案）。
//!
//! 协议（与前端 `crawl` 命令一致，不变）：
//! - `op`：categories | search | category | detail | images | cache_dump | cache_hydrate
//! - `payload`：JSON 对象（serde_json::Value），各 op 读取自己的字段
//! - 返回值：JSON 字符串（列表 / 对象 / 数组），失败返回空 JSON（`[]` / `{}`）
//!
//! 分派只做三件事：按 sourceId 查 [`sources::SOURCES`]；问 adapter 有没有 Rust 直连的
//! op（webtoons 的 cache_dump/cache_hydrate、mangadex 的 categories）；其余 op 交脚本执行。
//! 每个源的知识在 `crawler/sources/` 的一个文件里，本模块不认识任何具体的源。
//!
//! 结果缓存（`result_cache`）：列表/详情类 op 的成功结果写入内存 LRU + 磁盘
//! （cache_dir 为空表示禁用），供 `cached_result` 读取（前端 stale-while-revalidate 的
//! stale 一侧）；失败结果不写入。

pub mod http;
pub mod models;
pub mod render;
pub mod result_cache;
pub mod script;
pub mod sources;

use serde_json::Value;

/// 分发并返回 JSON 字符串。未知 source/op 按列表类返回 `[]`。
/// `script`：该 source 的运行时脚本（src-tauri 从 sources.json 同步进来）；Rust 直连的 op 忽略。
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
    sources::clear_error(source);
    serde_json::json!({ "data": value, "fetchedAt": at }).to_string()
}

/// 分派到源 adapter。第二个返回值表示本次结果是否成功（供结果缓存判定；未知 source、
/// 空脚本等不可缓存的情况返回 false）。
fn dispatch(op: &str, source: &str, payload: &str, script: &str) -> (String, bool) {
    let Some(src) = sources::get(source) else {
        return ("[]".into(), false);
    };
    let payload_val: Value = serde_json::from_str(payload).unwrap_or(Value::Null);
    if let Some(out) = src.native_op(op, &payload_val) {
        return out;
    }
    // 缓存管理 op 是协议的一部分：没有持久缓存的源按空操作成功，前端对当前源无条件调用。
    match op {
        "cache_dump" => return ("{}".into(), true),
        "cache_hydrate" => return ("true".into(), true),
        _ => {}
    }
    // 脚本尚未同步进 registry：该源的 op 按空结果返回（不算失败，不记错误）。
    if script.is_empty() {
        return ("[]".into(), false);
    }
    script::run(src, op, payload, script)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 分派：Rust 直连 op 不经脚本，缓存管理 op 对任意源都是空操作成功。
    #[test]
    fn dispatch_routes_native_and_cache_ops() {
        // mangadex categories 是 Rust 直连（空脚本也能跑）
        let (out, ok) = dispatch("categories", "mangadex", "{}", "");
        assert!(ok, "out = {out}");

        // 没有持久缓存的源：dump/hydrate 空操作成功
        assert_eq!(dispatch("cache_dump", "hentara", "{}", ""), ("{}".into(), true));
        assert_eq!(
            dispatch("cache_hydrate", "hentara", "{}", ""),
            ("true".into(), true)
        );

        // 未知 source
        assert_eq!(dispatch("search", "nope", "{}", "x"), ("[]".into(), false));

        // 空脚本的普通 op：空结果，不算成功
        assert_eq!(dispatch("search", "hentara", "{}", ""), ("[]".into(), false));
    }

    /// 缓存管理 op 不进结果缓存（`is_cacheable` 白名单）。
    #[test]
    fn cache_ops_are_not_result_cached() {
        assert!(!result_cache::is_cacheable("cache_dump"));
        assert!(!result_cache::is_cacheable("cache_hydrate"));
        assert!(result_cache::is_cacheable("detail"));
    }
}
