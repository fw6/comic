//! 结果缓存接线测试：crawl 成功写入 / 失败不写入，cached_result 读取命中（离线，无网络）。

use cimoc_core::{cached_result, crawl};

/// categories 是静态 op（buildUrl 返回空串，不经抓取），用它在离线环境跑通全链路。
const OK_SCRIPT: &str = r#"
function buildUrl(op, payload, ctx) { return ""; }
function parse(op, input, ctx) { return JSON.stringify(["动作", "恋爱"]); }
"#;

const FAIL_SCRIPT: &str = r#"
function buildUrl(op, payload, ctx) { return ""; }
function parse(op, input, ctx) { throw new Error("boom"); }
"#;

fn temp_dir(tag: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "cimoc-crawl-cache-test-{}-{}",
        tag,
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

#[test]
fn successful_crawl_writes_cache_and_cached_result_reads_it() {
    let dir = temp_dir("ok");
    let d = dir.to_str().unwrap();
    let payload = r#"{"tag":"ok"}"#;
    let out = crawl("categories", "webtoons", payload, OK_SCRIPT, d);
    assert_eq!(out, r#"["动作","恋爱"]"#);

    let cached = cached_result("categories", "webtoons", payload, OK_SCRIPT, d);
    let v: serde_json::Value = serde_json::from_str(&cached).unwrap();
    assert_eq!(v["data"], serde_json::json!(["动作", "恋爱"]));
    assert!(v["fetchedAt"].as_u64().unwrap() > 0);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn failed_crawl_not_cached() {
    let dir = temp_dir("fail");
    let d = dir.to_str().unwrap();
    let payload = r#"{"tag":"fail"}"#;
    let out = crawl("categories", "webtoons", payload, FAIL_SCRIPT, d);
    assert_eq!(out, "[]");
    assert_eq!(cached_result("categories", "webtoons", payload, FAIL_SCRIPT, d), "null");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn non_cacheable_op_returns_null() {
    let dir = temp_dir("images");
    let d = dir.to_str().unwrap();
    let payload = r#"{"tag":"img"}"#;
    crawl("images", "webtoons", payload, OK_SCRIPT, d);
    assert_eq!(cached_result("images", "webtoons", payload, OK_SCRIPT, d), "null");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn empty_cache_dir_disables() {
    let payload = r#"{"tag":"off"}"#;
    crawl("categories", "webtoons", payload, OK_SCRIPT, "");
    assert_eq!(cached_result("categories", "webtoons", payload, OK_SCRIPT, ""), "null");
}
