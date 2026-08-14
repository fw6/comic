//! 爬虫引擎解析单测：复用 app 侧原有的结构化 fixture，锁住字段映射行为。
//! 仅覆盖纯解析函数（不发起网络），与 `sparkling-cimoc` 侧 vitest 用例对齐。

use cimoc_core::crawler::{mangadex, webtoons};

const SEARCH: &str = include_str!("fixtures/mangadex-search.json");
const DETAIL: &str = include_str!("fixtures/mangadex-detail.json");
const FEED: &str = include_str!("fixtures/mangadex-feed.json");
const TAGS: &str = include_str!("fixtures/mangadex-tags.json");
const AT_HOME: &str = include_str!("fixtures/mangadex-at-home.json");
const SEARCH_CARD: &str = include_str!("fixtures/search-card.html");
const DETAIL_HTML: &str = include_str!("fixtures/detail.html");
const VIEWER: &str = include_str!("fixtures/viewer.html");

const MANGADEX_ID: &str = "7e544761-7d3d-4fce-8137-719814d7d138";

#[test]
fn mangadex_parsers() {
    // 搜索
    let search: serde_json::Value = serde_json::from_str(SEARCH).unwrap();
    let comics = mangadex::parse_search(&search);
    assert_eq!(comics.len(), 2);
    let first = &comics[0];
    assert_eq!(first.id, format!("mangadex-{}", MANGADEX_ID));
    assert_eq!(first.title, "Eleceed");
    assert_eq!(first.author, "Son Jae-Ho");
    assert!(first.cover.starts_with("https://uploads.mangadex.org/covers/"));
    assert!(first.cover.ends_with(".256.jpg"));
    assert_eq!(first.status, "serial");
    assert!(first.tags.iter().any(|t| t == "Action"));
    assert!(first.intro.contains("kind-hearted"));
    assert_eq!(comics[1].status, "finish");

    // 分类（tags）
    let tags: serde_json::Value = serde_json::from_str(TAGS).unwrap();
    assert_eq!(
        mangadex::parse_categories(&tags),
        vec!["Action", "Romance", "Fantasy"]
    );

    // 详情 + 章节
    let detail: serde_json::Value = serde_json::from_str(DETAIL).unwrap();
    let feed: serde_json::Value = serde_json::from_str(FEED).unwrap();
    let feed = feed.get("data").and_then(|d| d.as_array()).unwrap();
    let detail = mangadex::parse_detail(&detail, feed).unwrap();
    assert_eq!(detail.comic.title, "Eleceed");
    assert_eq!(detail.comic.author, "Son Jae-Ho");
    assert_eq!(
        detail.chapters.iter().map(|c| c.index).collect::<Vec<_>>(),
        vec![1.0, 2.0, 3.0]
    );
    assert_eq!(detail.chapters[0].title, "Welcome");
    assert_eq!(detail.chapters[1].title, "第 2 话");
    assert_eq!(detail.comic.last_chapter, "Rival");

    // at-home 图片 URL
    let at_home: serde_json::Value = serde_json::from_str(AT_HOME).unwrap();
    let imgs = mangadex::parse_at_home(&at_home);
    assert_eq!(imgs.len(), 2);
    assert!(imgs[0].starts_with("https://cmdxd98sb0x3yprd.mangadex.network/data/5ee6f31f"));
    assert!(imgs[0].contains("/f1-"));
}

#[test]
fn webtoons_parsers() {
    // 分类
    assert_eq!(webtoons::categories().len(), 8);

    // slug 提取
    assert_eq!(
        webtoons::slug_from_series_url(
            "https://www.webtoons.com/en/action/eleceed/list?title_no=1571"
        ),
        Some("action/eleceed".to_string())
    );

    // 搜索卡片
    let comics = webtoons::parse_series_list(SEARCH_CARD);
    assert_eq!(comics.len(), 1);
    assert_eq!(comics[0].id, "webtoons-1571");
    assert_eq!(comics[0].title, "Eleceed");
    assert!(comics[0].cover.contains("webtoon-phinf.pstatic.net"));
    // 系列 URL 进入缓存
    let cache: serde_json::Value =
        serde_json::from_str(&webtoons::crawl("cache_dump", &serde_json::json!({}))).unwrap();
    assert_eq!(
        cache.get("1571").and_then(|v| v.as_str()),
        Some("https://www.webtoons.com/en/action/eleceed/list?title_no=1571")
    );

    // 详情
    let detail = webtoons::parse_detail(DETAIL_HTML, "1571");
    assert_eq!(detail.comic.title, "Eleceed");
    assert_eq!(detail.comic.author, "Jeho Son");
    assert!(detail.comic.intro.contains("Jiwoo is a kind-hearted young man"));
    assert!(detail.comic.cover.contains("swebtoon-phinf.pstatic.net"));
    assert_eq!(
        detail.chapters.iter().map(|c| c.index).collect::<Vec<_>>(),
        vec![398.0, 397.0, 396.0]
    );
    assert_eq!(detail.chapters[0].title, "Episode 398");
    assert_eq!(detail.chapters[2].title, "Episode 396");
    assert_eq!(detail.comic.last_chapter, "Episode 398");

    // viewer 图片
    let imgs = webtoons::parse_viewer(VIEWER);
    assert_eq!(imgs.len(), 3);
    for u in &imgs {
        assert!(u.starts_with("https://webtoon-phinf.pstatic.net/"));
    }
}

#[test]
fn webtoons_cache_hydrate_only_fills_missing() {
    // 用独立 key 隔离，避免与其它用例的缓存状态互相影响。
    let key = "hydrate-test-9999";
    let url = "https://www.webtoons.com/en/test/comic/list?title_no=9999";
    webtoons::crawl(
        "cache_hydrate",
        &serde_json::json!({ key: url }),
    );
    let dump: serde_json::Value =
        serde_json::from_str(&webtoons::crawl("cache_dump", &serde_json::json!({}))).unwrap();
    assert_eq!(dump.get(key).and_then(|v| v.as_str()), Some(url));

    // 已有值不被覆盖
    webtoons::crawl("cache_hydrate", &serde_json::json!({ key: "overwrite" }));
    let dump2: serde_json::Value =
        serde_json::from_str(&webtoons::crawl("cache_dump", &serde_json::json!({}))).unwrap();
    assert_eq!(dump2.get(key).and_then(|v| v.as_str()), Some(url));
}
