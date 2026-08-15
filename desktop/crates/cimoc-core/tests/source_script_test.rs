//! 源脚本引擎冒烟（wayfinder #17 双轨测试的 Rust 侧）：真实 QuickJS 引擎跑内置脚本，
//! 对 fixture 断言关键输出——兜 vitest（node）与 QuickJS 的环境偏差。
//! 仅覆盖脚本函数本身（buildUrl/parse），不发起网络。

use cimoc_core::js;

const WEBTOONS_JS: &str = include_str!("../src/js/sources/webtoons.js");
const MANGADEX_JS: &str = include_str!("../src/js/sources/mangadex.js");

const SEARCH_CARD: &str = include_str!("fixtures/search-card.html");
const DETAIL_HTML: &str = include_str!("fixtures/detail.html");
const VIEWER: &str = include_str!("fixtures/viewer.html");
const MANGADEX_SEARCH: &str = include_str!("fixtures/mangadex-search.json");
const MANGADEX_DETAIL: &str = include_str!("fixtures/mangadex-detail.json");
const MANGADEX_FEED: &str = include_str!("fixtures/mangadex-feed.json");
const MANGADEX_AT_HOME: &str = include_str!("fixtures/mangadex-at-home.json");

fn parse(script: &str, op: &str, input: &str, ctx: &str) -> serde_json::Value {
    let json = js::call(script, "parse", op, input, ctx).expect("parse 应成功");
    serde_json::from_str(&json).expect("输出应为合法 JSON")
}

fn build_url(script: &str, op: &str, payload: &str, ctx: &str) -> String {
    js::call(script, "buildUrl", op, payload, ctx).expect("buildUrl 应成功")
}

// ---------- webtoons ----------

#[test]
fn webtoons_categories_static() {
    let v = parse(WEBTOONS_JS, "categories", "", "{}");
    let cats = v.as_array().unwrap();
    assert_eq!(cats.len(), 8);
    assert_eq!(cats[1], "恋爱");
}

#[test]
fn webtoons_build_url() {
    assert!(build_url(WEBTOONS_JS, "search", r#"{"keyword":"eleceed"}"#, "{}")
        .starts_with("https://www.webtoons.com/en/search?keyword="));
    assert_eq!(
        build_url(WEBTOONS_JS, "category", r#"{"label":"恋爱"}"#, "{}"),
        "https://www.webtoons.com/en/genres/romance"
    );
    // detail：有缓存的 seriesUrl 用缓存，否则 any 兜底
    let series = "https://www.webtoons.com/en/action/eleceed/list?title_no=1571";
    assert_eq!(
        build_url(WEBTOONS_JS, "detail", r#"{"comicId":"webtoons-1571"}"#, &format!(r#"{{"seriesUrl":"{series}","titleNo":"1571"}}"#)),
        series
    );
    assert_eq!(
        build_url(WEBTOONS_JS, "detail", r#"{"comicId":"webtoons-1571"}"#, r#"{"seriesUrl":"","titleNo":"1571"}"#),
        "https://www.webtoons.com/en/any/list?title_no=1571"
    );
    // images：有 slug 用真实 viewer 路径
    assert_eq!(
        build_url(
            WEBTOONS_JS,
            "images",
            r#"{"comicId":"webtoons-1571","chapterIndex":398}"#,
            &format!(r#"{{"seriesUrl":"{series}","titleNo":"1571"}}"#)
        ),
        "https://www.webtoons.com/en/action/eleceed/episode-398/viewer?title_no=1571&episode_no=398"
    );
}

#[test]
fn webtoons_search_parse() {
    let v = parse(WEBTOONS_JS, "search", SEARCH_CARD, "{}");
    let comics = v.as_array().unwrap();
    assert_eq!(comics.len(), 1);
    assert_eq!(comics[0]["id"], "webtoons-1571");
    assert_eq!(comics[0]["title"], "Eleceed");
    assert!(comics[0]["cover"]
        .as_str()
        .unwrap()
        .contains("webtoon-phinf.pstatic.net"));
    // 隐藏字段：seriesUrl（Rust 后处理提取入缓存后剥离）
    assert_eq!(
        comics[0]["seriesUrl"],
        "https://www.webtoons.com/en/action/eleceed/list?title_no=1571"
    );
}

#[test]
fn webtoons_detail_parse() {
    let ctx = r#"{"seriesUrl":"","titleNo":"1571"}"#;
    let v = parse(WEBTOONS_JS, "detail", DETAIL_HTML, ctx);
    let comic = &v["comic"];
    assert_eq!(comic["title"], "Eleceed");
    assert_eq!(comic["author"], "Jeho Son");
    assert!(comic["intro"]
        .as_str()
        .unwrap()
        .contains("Jiwoo is a kind-hearted young man"));
    assert!(comic["cover"].as_str().unwrap().contains("swebtoon-phinf.pstatic.net"));
    assert_eq!(comic["tags"][0], "Webtoons");
    let chapters = v["chapters"].as_array().unwrap();
    let indexes: Vec<f64> = chapters.iter().map(|c| c["index"].as_f64().unwrap()).collect();
    assert_eq!(indexes, vec![398.0, 397.0, 396.0]);
    assert_eq!(chapters[0]["title"], "Episode 398");
    assert_eq!(comic["lastChapter"], "Episode 398");
}

#[test]
fn webtoons_viewer_parse() {
    let v = parse(WEBTOONS_JS, "images", VIEWER, "{}");
    let urls = v.as_array().unwrap();
    assert_eq!(urls.len(), 3);
    for u in urls {
        assert!(u.as_str().unwrap().starts_with("https://webtoon-phinf.pstatic.net/"));
    }
}

// ---------- mangadex ----------

#[test]
fn mangadex_build_url() {
    let url = build_url(MANGADEX_JS, "search", r#"{"keyword":"eleceed"}"#, "{}");
    assert!(url.starts_with("https://api.mangadex.org/manga?title="));
    assert!(url.contains("contentRating[]=safe"));
    assert_eq!(
        build_url(MANGADEX_JS, "category", r#"{"label":"Action"}"#, r#"{"label":"Action","tagId":"391b0423-d847-456f-aff0-8b0cfc03066b"}"#),
        "https://api.mangadex.org/manga?includedTags[]=391b0423-d847-456f-aff0-8b0cfc03066b&limit=24&includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive"
    );
    // 无 tagId → 空串（无可抓取）
    assert!(build_url(MANGADEX_JS, "category", r#"{"label":"Nope"}"#, r#"{"tagId":null}"#).is_empty());
    assert_eq!(
        build_url(MANGADEX_JS, "detail", r#"{"comicId":"mangadex-7e544761-7d3d-4fce-8137-719814d7d138"}"#, "{}"),
        "https://api.mangadex.org/manga/7e544761-7d3d-4fce-8137-719814d7d138?includes[]=author&includes[]=artist&includes[]=cover_art"
    );
    assert_eq!(
        build_url(MANGADEX_JS, "images", r#"{"comicId":"mangadex-x","chapterIndex":1}"#, r#"{"chapterId":"59dcd5b1-8d41-4940-b5c6-60c684be5f69"}"#),
        "https://api.mangadex.org/at-home/server/59dcd5b1-8d41-4940-b5c6-60c684be5f69"
    );
    assert!(build_url(MANGADEX_JS, "images", r#"{"comicId":"mangadex-x","chapterIndex":1}"#, r#"{"chapterId":null}"#).is_empty());
}

#[test]
fn mangadex_search_parse() {
    let v = parse(MANGADEX_JS, "search", MANGADEX_SEARCH, "{}");
    let comics = v.as_array().unwrap();
    assert_eq!(comics.len(), 2);
    let first = &comics[0];
    assert_eq!(first["id"], "mangadex-7e544761-7d3d-4fce-8137-719814d7d138");
    assert_eq!(first["title"], "Eleceed");
    assert_eq!(first["author"], "Son Jae-Ho");
    assert!(first["cover"].as_str().unwrap().starts_with("https://uploads.mangadex.org/covers/"));
    assert!(first["cover"].as_str().unwrap().ends_with(".256.jpg"));
    assert_eq!(first["status"], "serial");
    assert!(first["tags"].as_array().unwrap().iter().any(|t| t == "Action"));
    assert!(first["intro"].as_str().unwrap().contains("kind-hearted"));
    assert_eq!(comics[1]["status"], "finish");
}

#[test]
fn mangadex_detail_parse() {
    let feed: serde_json::Value = serde_json::from_str(MANGADEX_FEED).unwrap();
    let ctx = format!(r#"{{"feed":{}}}"#, feed["data"]);
    let v = parse(MANGADEX_JS, "detail", MANGADEX_DETAIL, &ctx);
    assert_eq!(v["comic"]["title"], "Eleceed");
    assert_eq!(v["comic"]["author"], "Son Jae-Ho");
    let chapters = v["chapters"].as_array().unwrap();
    let indexes: Vec<f64> = chapters.iter().map(|c| c["index"].as_f64().unwrap()).collect();
    assert_eq!(indexes, vec![1.0, 2.0, 3.0]);
    assert_eq!(chapters[0]["title"], "Welcome");
    assert_eq!(chapters[1]["title"], "第 2 话");
    assert!(!chapters[0]["external"].as_bool().unwrap());
    assert!(chapters[1]["external"].as_bool().unwrap());
    assert!(!chapters[2]["external"].as_bool().unwrap());
    assert_eq!(v["comic"]["lastChapter"], "Rival");
}

#[test]
fn mangadex_at_home_parse() {
    let v = parse(MANGADEX_JS, "images", MANGADEX_AT_HOME, "{}");
    let urls = v.as_array().unwrap();
    assert_eq!(urls.len(), 2);
    assert!(urls[0]
        .as_str()
        .unwrap()
        .starts_with("https://cmdxd98sb0x3yprd.mangadex.network/data/5ee6f31f"));
    assert!(urls[0].as_str().unwrap().contains("/f1-"));
}

// ---------- 分发 ----------

#[test]
fn crawl_dispatch_routes_script_and_cache_ops() {
    // webtoons categories 走脚本（静态输出）
    let cats = cimoc_core::crawl("categories", "webtoons", "{}", WEBTOONS_JS);
    assert!(cats.contains("奇幻"));

    // cache op 不经脚本（脚本参数被忽略）
    let payload = r#"{"cache-test-1":"https://www.webtoons.com/en/x/y/list?title_no=1"}"#;
    assert_eq!(cimoc_core::crawl("cache_hydrate", "webtoons", payload, ""), "true");
    let dump: serde_json::Value =
        serde_json::from_str(&cimoc_core::crawl("cache_dump", "webtoons", "{}", "")).unwrap();
    assert_eq!(
        dump.get("cache-test-1").and_then(|v| v.as_str()),
        Some("https://www.webtoons.com/en/x/y/list?title_no=1")
    );
    // 已有值不被覆盖
    cimoc_core::crawl(
        "cache_hydrate",
        "webtoons",
        r#"{"cache-test-1":"overwrite"}"#,
        "",
    );
    let dump2: serde_json::Value =
        serde_json::from_str(&cimoc_core::crawl("cache_dump", "webtoons", "{}", "")).unwrap();
    assert_eq!(
        dump2.get("cache-test-1").and_then(|v| v.as_str()),
        Some("https://www.webtoons.com/en/x/y/list?title_no=1")
    );

    // 未知 source → 空数组
    assert_eq!(cimoc_core::crawl("search", "unknown", "{}", ""), "[]");
    // 脚本源但未同步脚本 → 空数组（启动同步前的保护）
    assert_eq!(cimoc_core::crawl("search", "webtoons", "{}", ""), "[]");
}
