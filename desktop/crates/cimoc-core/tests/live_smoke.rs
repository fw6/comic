//! 真网冒烟（wayfinder #17 双轨之外的手动验证）：默认忽略，`cargo test -- --ignored` 手动跑。
//! 用真实网络验证脚本源全链路（buildUrl → 抓取 → parse → 输出非空）。
//! CI 不跑：依赖外网站点，易受网络/反爬波动影响。

use cimoc_core::js;

fn live_crawl(source: &str, op: &str, payload: &str) -> serde_json::Value {
    let script = js::sources::load(source).expect("内置脚本");
    let out = cimoc_core::crawl(op, source, payload, &script);
    serde_json::from_str(&out).expect("输出应为合法 JSON")
}

#[test]
#[ignore]
fn webtoons_live_search() {
    let comics = live_crawl("webtoons", "search", r#"{"keyword":"eleceed"}"#);
    let arr = comics.as_array().expect("search 返回数组");
    assert!(!arr.is_empty(), "webtoons 搜索应有结果");
    println!("webtoons: {} 条，首条 {} / {}", arr.len(), arr[0]["id"], arr[0]["title"]);
}

#[test]
#[ignore]
fn mangadex_live_search() {
    let comics = live_crawl("mangadex", "search", r#"{"keyword":"eleceed"}"#);
    let arr = comics.as_array().expect("search 返回数组");
    assert!(!arr.is_empty(), "mangadex 搜索应有结果");
    println!("mangadex: {} 条，首条 {} / {}", arr.len(), arr[0]["id"], arr[0]["title"]);
}

#[test]
#[ignore]
fn mangadex_live_detail() {
    // 用上面搜索到的第一本的 id
    let comics = live_crawl("mangadex", "search", r#"{"keyword":"eleceed"}"#);
    let id = comics[0]["id"].as_str().expect("comicId").to_string();
    let detail = live_crawl("mangadex", "detail", &format!(r#"{{"comicId":"{id}"}}"#));
    assert!(detail["chapters"].as_array().map(|c| !c.is_empty()).unwrap_or(false));
    println!("mangadex detail: {} 章，lastChapter {}", detail["chapters"].as_array().unwrap().len(), detail["comic"]["lastChapter"]);
}
