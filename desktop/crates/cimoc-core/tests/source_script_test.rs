//! 源脚本引擎冒烟（wayfinder #17 双轨测试的 Rust 侧）：真实 QuickJS 引擎跑内置脚本，
//! 对 fixture 断言关键输出——兜 vitest（node）与 QuickJS 的环境偏差。
//! 仅覆盖脚本函数本身（buildUrl/parse），不发起网络。

use cimoc_core::js;

const WEBTOONS_JS: &str = include_str!("../src/js/sources/webtoons.js");
const MANGADEX_JS: &str = include_str!("../src/js/sources/mangadex.js");
const COMYMANGA_JS: &str = include_str!("../src/js/sources/copymanga.js");
const DONGMAN_JS: &str = include_str!("../src/js/sources/dongman.js");
const MANHUAGUI_JS: &str = include_str!("../src/js/sources/manhuagui.js");
const BAOZIMH_JS: &str = include_str!("../src/js/sources/baozimh.js");

const SEARCH_CARD: &str = include_str!("fixtures/search-card.html");
const DETAIL_HTML: &str = include_str!("fixtures/detail.html");
const VIEWER: &str = include_str!("fixtures/viewer.html");
const MANGADEX_SEARCH: &str = include_str!("fixtures/mangadex-search.json");
const MANGADEX_DETAIL: &str = include_str!("fixtures/mangadex-detail.json");
const MANGADEX_FEED: &str = include_str!("fixtures/mangadex-feed.json");
const MANGADEX_AT_HOME: &str = include_str!("fixtures/mangadex-at-home.json");
const COMYMANGA_SEARCH: &str = include_str!("fixtures/copymanga-search.json");
const COMYMANGA_DETAIL: &str = include_str!("fixtures/copymanga-detail.json");
const COMYMANGA_FEED: &str = include_str!("fixtures/copymanga-feed.json");
const COMYMANGA_CHAPTER: &str = include_str!("fixtures/copymanga-chapter.json");
const DONGMAN_SEARCH: &str = include_str!("fixtures/dongman-search.html");
const DONGMAN_DETAIL: &str = include_str!("fixtures/dongman-detail.html");
const DONGMAN_VIEWER: &str = include_str!("fixtures/dongman-viewer.html");
const MANHUAGUI_SEARCH: &str = include_str!("fixtures/manhuagui-search.html");
const MANHUAGUI_DETAIL: &str = include_str!("fixtures/manhuagui-detail.html");
const MANHUAGUI_CHAPTER: &str = include_str!("fixtures/manhuagui-chapter.html");
const BAOZIMH_SEARCH: &str = include_str!("fixtures/baozimh-search.html");
const BAOZIMH_DETAIL: &str = include_str!("fixtures/baozimh-detail.html");
const BAOZIMH_CHAPTER: &str = include_str!("fixtures/baozimh-chapter.html");

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

// ---------- copymanga ----------

#[test]
fn copymanga_build_url() {
    assert_eq!(
        build_url(COMYMANGA_JS, "search", r#"{"keyword":"海贼王"}"#, "{}"),
        "https://api.mangacopy.com/api/v3/search/comic?format=json&platform=3&q=%E6%B5%B7%E8%B4%BC%E7%8E%8B&offset=0&limit=20"
    );
    assert_eq!(
        build_url(COMYMANGA_JS, "category", r#"{"label":"冒险"}"#, "{}"),
        "https://api.mangacopy.com/api/v3/comics?platform=3&limit=20&offset=0&theme=maoxian"
    );
    // 未知分类 → 不带 theme（默认最新列表）
    assert_eq!(
        build_url(COMYMANGA_JS, "category", r#"{"label":"不存在的分类"}"#, "{}"),
        "https://api.mangacopy.com/api/v3/comics?platform=3&limit=20&offset=0"
    );
    assert_eq!(
        build_url(COMYMANGA_JS, "detail", r#"{"comicId":"copymanga-haizeiwang"}"#, "{}"),
        "https://api.mangacopy.com/api/v3/comic2/haizeiwang?platform=3"
    );
    assert_eq!(
        build_url(COMYMANGA_JS, "images", r#"{"comicId":"copymanga-haizeiwang","chapterIndex":1}"#, r#"{"chapterUuid":"ch-1"}"#),
        "https://api.mangacopy.com/api/v3/comic/haizeiwang/chapter2/ch-1?platform=3"
    );
    // 无 chapterUuid → 空串（无可抓取）
    assert!(build_url(COMYMANGA_JS, "images", r#"{"comicId":"copymanga-haizeiwang","chapterIndex":1}"#, r#"{"chapterUuid":null}"#).is_empty());
}

#[test]
fn copymanga_search_parse() {
    let v = parse(COMYMANGA_JS, "search", COMYMANGA_SEARCH, "{}");
    let comics = v.as_array().unwrap();
    assert_eq!(comics.len(), 3);
    let first = &comics[0];
    assert_eq!(first["id"], "copymanga-haizeiwang");
    assert_eq!(first["title"], "海贼王");
    assert_eq!(first["author"], "尾田栄一郎");
    assert!(first["cover"].as_str().unwrap().starts_with("https://"));
    assert_eq!(first["source"], "copymanga");
    assert_eq!(first["status"], "serial");
}

#[test]
fn copymanga_detail_parse() {
    let feed: serde_json::Value = serde_json::from_str(COMYMANGA_FEED).unwrap();
    let ctx = format!(r#"{{"feed":{}}}"#, feed["results"]["list"]);
    let v = parse(COMYMANGA_JS, "detail", COMYMANGA_DETAIL, &ctx);
    assert_eq!(v["comic"]["title"], "海贼王");
    assert_eq!(v["comic"]["author"], "尾田栄一郎");
    assert!(v["comic"]["intro"].as_str().unwrap().contains("海贼王"));
    assert_eq!(v["comic"]["status"], "serial");
    assert_eq!(v["comic"]["lastChapter"], "第 1000 话");
    assert_eq!(v["comic"]["tags"][0], "热血");
    let chapters = v["chapters"].as_array().unwrap();
    let indexes: Vec<f64> = chapters.iter().map(|c| c["index"].as_f64().unwrap()).collect();
    assert_eq!(indexes, vec![1.0, 2.0, 3.0]);
    assert_eq!(chapters[0]["title"], "第 1 话");
}

#[test]
fn copymanga_chapter_parse() {
    let v = parse(COMYMANGA_JS, "images", COMYMANGA_CHAPTER, "{}");
    let urls = v.as_array().unwrap();
    assert_eq!(urls.len(), 2);
    assert!(urls[0].as_str().unwrap().starts_with("https://sh.mangafunb.fun/h/haizeiwang/chapter/"));
}

#[test]
fn copymanga_categories_static() {
    let v = parse(COMYMANGA_JS, "categories", "", "{}");
    let cats = v.as_array().unwrap();
    assert_eq!(cats.len(), 17);
    assert!(cats.contains(&serde_json::Value::String("冒险".into())));
    assert!(cats.contains(&serde_json::Value::String("百合".into())));
}

// ---------- dongman ----------

#[test]
fn dongman_build_url() {
    assert_eq!(
        build_url(DONGMAN_JS, "search", r#"{"keyword":"甜蜜"}"#, "{}"),
        "https://www.dongmanmanhua.cn/search?keyword=%E7%94%9C%E8%9C%9C"
    );
    assert_eq!(
        build_url(DONGMAN_JS, "category", r#"{"label":"少年"}"#, "{}"),
        "https://www.dongmanmanhua.cn/BOY"
    );
    // 未知分类 → 空串（无可抓取）
    assert!(build_url(DONGMAN_JS, "category", r#"{"label":"未知"}"#, "{}").is_empty());
    assert_eq!(
        build_url(DONGMAN_JS, "detail", r#"{"comicId":"dongman-1418"}"#, "{}"),
        "https://www.dongmanmanhua.cn/episodeList?titleNo=1418"
    );
    // images：viewer URL 由 Rust 提供；无则空串
    let viewer = "https://www.dongmanmanhua.cn/METROPOLIS/x/viewer?title_no=2859&episode_no=10";
    assert_eq!(
        build_url(DONGMAN_JS, "images", r#"{"comicId":"dongman-2859","chapterIndex":10}"#, &format!(r#"{{"viewerUrl":"{viewer}"}}"#)),
        viewer
    );
    assert!(build_url(DONGMAN_JS, "images", r#"{"comicId":"dongman-2859","chapterIndex":10}"#, r#"{"viewerUrl":null}"#).is_empty());
}

#[test]
fn dongman_search_parse() {
    let v = parse(DONGMAN_JS, "search", DONGMAN_SEARCH, "{}");
    let comics = v.as_array().unwrap();
    assert_eq!(comics.len(), 3);
    let first = &comics[0];
    assert_eq!(first["id"], "dongman-1418");
    assert_eq!(first["title"], "甜蜜保质期");
    assert_eq!(first["author"], "黑琪可可 / 惊歌");
    assert!(first["cover"]
        .as_str()
        .unwrap()
        .starts_with("https://cdn.dongmanmanhua.cn/"));
    assert_eq!(first["source"], "dongman");
    // 首页分类榜单 li（无 data-title-no）被过滤
    assert!(!comics.iter().any(|c| c["id"] == "dongman-1139"));
}

#[test]
fn dongman_detail_parse() {
    let ctx = r#"{"titleNo":"2859"}"#;
    let v = parse(DONGMAN_JS, "detail", DONGMAN_DETAIL, ctx);
    let comic = &v["comic"];
    assert_eq!(comic["title"], "跳槽日志");
    assert_eq!(comic["author"], "Woo Si-mok, Lee Ha-an");
    assert!(comic["intro"].as_str().unwrap().contains("社恐打工人"));
    assert_eq!(
        comic["cover"],
        "https://cdn-sns.dongmanmanhua.cn/e452801b-3c10-4680-beae-63c3535baae3.jpg"
    );
    assert_eq!(comic["lastChapter"], "【免费】第1季后记");
    let chapters = v["chapters"].as_array().unwrap();
    let indexes: Vec<f64> = chapters.iter().map(|c| c["index"].as_f64().unwrap()).collect();
    assert_eq!(indexes, vec![55.0, 10.0, 9.0]);
    assert_eq!(chapters[0]["title"], "【免费】第1季后记");
}

#[test]
fn dongman_viewer_parse() {
    let v = parse(DONGMAN_JS, "images", DONGMAN_VIEWER, "{}");
    let urls = v.as_array().unwrap();
    assert_eq!(urls.len(), 3);
    for u in urls {
        assert!(u
            .as_str()
            .unwrap()
            .starts_with("https://cdn.dongmanmanhua.cn/"));
    }
}

// ---------- manhuagui ----------

#[test]
fn manhuagui_build_url() {
    assert_eq!(
        build_url(MANHUAGUI_JS, "search", r#"{"keyword":"音速"}"#, "{}"),
        "https://www.manhuagui.com/s/%E9%9F%B3%E9%80%9F_p1.html"
    );
    assert_eq!(
        build_url(MANHUAGUI_JS, "category", r#"{"label":"热血"}"#, "{}"),
        "https://www.manhuagui.com/list/rexue/"
    );
    // 未知分类 → 空串
    assert!(build_url(MANHUAGUI_JS, "category", r#"{"label":"未知"}"#, "{}").is_empty());
    assert_eq!(
        build_url(MANHUAGUI_JS, "detail", r#"{"comicId":"manhuagui-43847"}"#, "{}"),
        "https://www.manhuagui.com/comic/43847/"
    );
    // images：章节号即章节页 href 的 cid
    assert_eq!(
        build_url(MANHUAGUI_JS, "images", r#"{"comicId":"manhuagui-43847","chapterIndex":901676}"#, "{}"),
        "https://www.manhuagui.com/comic/43847/901676.html"
    );
}

#[test]
fn manhuagui_search_parse() {
    let v = parse(MANHUAGUI_JS, "search", MANHUAGUI_SEARCH, "{}");
    let comics = v.as_array().unwrap();
    assert_eq!(comics.len(), 2);
    let first = &comics[0];
    assert_eq!(first["id"], "manhuagui-48320");
    assert_eq!(first["title"], "用最强天赋开始经营领地慢生活");
    assert!(first["author"].as_str().unwrap().contains("眠田睑"));
    assert_eq!(first["cover"], "https://cf.mhgui.com/cpic/b/48320.jpg");
    assert_eq!(first["status"], "serial");
    assert_eq!(comics[1]["status"], "finish");
    assert!(first["intro"].as_str().unwrap().contains("梅尔基斯"));
}

#[test]
fn manhuagui_detail_parse() {
    let ctx = r#"{"comicId":"manhuagui-43847"}"#;
    let v = parse(MANHUAGUI_JS, "detail", MANHUAGUI_DETAIL, ctx);
    assert_eq!(v["comic"]["title"], "脑洞学生会");
    assert_eq!(v["comic"]["cover"], "https://cf.mhgui.com/cpic/h/43847_14.jpg");
    assert!(v["comic"]["intro"].as_str().unwrap().contains("水之江梅"));
    assert_eq!(v["comic"]["lastChapter"], "第180话");
    let chapters = v["chapters"].as_array().unwrap();
    let indexes: Vec<f64> = chapters.iter().map(|c| c["index"].as_f64().unwrap()).collect();
    assert_eq!(indexes, vec![628732.0, 633620.0, 755107.0, 901676.0]);
    assert_eq!(chapters[3]["title"], "第180话");
    // 同类推荐里其它漫画的章节（/comic/52300/…）被过滤
    assert!(!chapters.iter().any(|c| c["index"] == 902850.0));
}

#[test]
fn manhuagui_chapter_parse_unpacks_packer() {
    let v = parse(MANHUAGUI_JS, "images", MANHUAGUI_CHAPTER, "{}");
    let urls = v.as_array().unwrap();
    assert_eq!(urls.len(), 4);
    assert_eq!(
        urls[0],
        "https://us.hamreus.com/02/43847/901676/1_abc.jpg?e=1651837515&m=1111111111"
    );
    assert_eq!(
        urls[3],
        "https://us.hamreus.com/02/43847/901676/4_jkl.jpg?e=1651837515&m=1111111111"
    );
}

// ---------- baozimh ----------

#[test]
fn baozimh_build_url() {
    assert_eq!(
        build_url(BAOZIMH_JS, "search", r#"{"keyword":"海贼"}"#, "{}"),
        "https://cn.baozimh.com/search?q=%E6%B5%B7%E8%B4%BC"
    );
    assert_eq!(
        build_url(BAOZIMH_JS, "category", r#"{"label":"热血"}"#, "{}"),
        "https://cn.baozimh.com/classify?type=rexue&region=all&state=all&filter=%2a"
    );
    // 未知分类 → 空串（无可抓取）
    assert!(build_url(BAOZIMH_JS, "category", r#"{"label":"未知"}"#, "{}").is_empty());
    assert_eq!(
        build_url(BAOZIMH_JS, "detail", r#"{"comicId":"baozimh-haizeiwang-x"}"#, "{}"),
        "https://cn.baozimh.com/comic/haizeiwang-x"
    );
    // images：URL 来自 Rust 缓存的章节中转链（同 dongman viewerUrl 形状）
    let page = "https://cn.baozimh.com/user/page_direct?comic_id=a_i1&section_slot=0&chapter_slot=0";
    assert_eq!(
        build_url(
            BAOZIMH_JS,
            "images",
            r#"{"comicId":"baozimh-a","chapterIndex":1}"#,
            &format!(r#"{{"pageUrl":"{page}"}}"#)
        ),
        page
    );
    // 缓存缺失 → 空串
    assert!(build_url(BAOZIMH_JS, "images", r#"{"comicId":"baozimh-a","chapterIndex":1}"#, "{}").is_empty());
}

#[test]
fn baozimh_categories_static() {
    let v = parse(BAOZIMH_JS, "categories", "", "{}");
    let cats = v.as_array().unwrap();
    assert_eq!(cats.len(), 25);
    assert!(cats.contains(&serde_json::Value::String("热血".into())));
    assert!(cats.contains(&serde_json::Value::String("恋爱".into())));
}

#[test]
fn baozimh_search_parse() {
    let v = parse(BAOZIMH_JS, "search", BAOZIMH_SEARCH, "{}");
    let comics = v.as_array().unwrap();
    assert_eq!(comics.len(), 2);
    let first = &comics[0];
    assert_eq!(first["id"], "baozimh-haizeiwang-weitianrongyilang");
    assert_eq!(first["title"], "海贼王");
    // 作者在卡片第二个锚（comics-card__info）里
    assert_eq!(first["author"], "尾田荣一郎");
    assert_eq!(
        first["cover"],
        "https://static-tw.baozimh.com/cover/haizeiwang-weitianrongyilang.jpg?w=285&h=375&q=100"
    );
    assert_eq!(first["source"], "baozimh");
    assert_eq!(comics[1]["id"], "baozimh-haizeiwangyellow-weitianrongyilang");
    assert_eq!(comics[1]["title"], "海贼王yellow");
}

#[test]
fn baozimh_detail_parse() {
    let ctx = r#"{"comicId":"baozimh-haizeiwang-weitianrongyilang"}"#;
    let v = parse(BAOZIMH_JS, "detail", BAOZIMH_DETAIL, ctx);
    let comic = &v["comic"];
    assert_eq!(comic["id"], "baozimh-haizeiwang-weitianrongyilang");
    assert_eq!(comic["title"], "航海王");
    assert_eq!(comic["author"], "尾田荣一郎");
    assert!(comic["intro"].as_str().unwrap().contains("哥尔"));
    assert_eq!(
        comic["cover"],
        "https://static-tw.baozimh.com/cover/hanghaiwang-weitianrongyilang.jpg?w=285&h=375&q=100"
    );
    assert_eq!(comic["status"], "serial");
    // tag-list 首个 span 是状态，其余是地区/类型
    assert_eq!(comic["tags"][0], "日本");
    assert_eq!(comic["tags"][3], "热血");
    // 「最新：」取章节锚文本（页头「最新上架」菜单不得干扰）
    assert_eq!(comic["lastChapter"], "第1186话 再一次");

    // 可见区（最新 3 话）与 chapters_other_list（全量）重复项去重后按槽位升序，index = 1 起序号
    let chapters = v["chapters"].as_array().unwrap();
    assert_eq!(chapters.len(), 5);
    let indexes: Vec<f64> = chapters.iter().map(|c| c["index"].as_f64().unwrap()).collect();
    assert_eq!(indexes, vec![1.0, 2.0, 3.0, 4.0, 5.0]);
    assert_eq!(chapters[0]["title"], "第1话 ROMANCE DAWN 冒险的序幕");
    assert_eq!(chapters[4]["title"], "第1186话 再一次");
    // 隐藏字段 pageUrl（中转链完整 URL，Rust post_process 提取入缓存后剥离）
    assert!(chapters[0]["pageUrl"]
        .as_str()
        .unwrap()
        .starts_with("https://cn.baozimh.com/user/page_direct?comic_id=hanghaiwang-weitianrongyilang_i6wg8y"));
    assert!(chapters[4]["pageUrl"].as_str().unwrap().contains("chapter_slot=1186"));
}

#[test]
fn baozimh_chapter_parse() {
    let v = parse(BAOZIMH_JS, "images", BAOZIMH_CHAPTER, "{}");
    let urls = v.as_array().unwrap();
    // noscript 备份图 / amp-state JSON / 重载按钮 URL 都不是 chapter-img，不会混入
    assert_eq!(urls.len(), 3);
    assert_eq!(
        urls[0],
        "https://s1.bzcdn.net/scomic/hanghaiwang-weitianrongyilang/0/24-3olw/1.jpg"
    );
    assert_eq!(
        urls[2],
        "https://s1.bzcdn.net/scomic/hanghaiwang-weitianrongyilang/0/24-3olw/3.jpg"
    );
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
    // copymanga：有脚本走脚本（categories 静态输出），无脚本空数组
    let cats = cimoc_core::crawl("categories", "copymanga", "{}", COMYMANGA_JS);
    assert!(cats.contains("冒险"));
    assert_eq!(cimoc_core::crawl("search", "copymanga", "{}", ""), "[]");
    // dongman：有脚本走脚本，无脚本空数组
    let cats = cimoc_core::crawl("categories", "dongman", "{}", DONGMAN_JS);
    assert!(cats.contains("恋爱"));
    assert_eq!(cimoc_core::crawl("search", "dongman", "{}", ""), "[]");
    // manhuagui：有脚本走脚本，无脚本空数组
    let cats = cimoc_core::crawl("categories", "manhuagui", "{}", MANHUAGUI_JS);
    assert!(cats.contains("热血"));
    assert_eq!(cimoc_core::crawl("search", "manhuagui", "{}", ""), "[]");
    // baozimh：categories 静态输出走脚本；需抓取的 op 在无渲染通道宿主下报错并返回空结果
    let cats = cimoc_core::crawl("categories", "baozimh", "{}", BAOZIMH_JS);
    assert!(cats.contains("热血"));
    assert_eq!(cimoc_core::crawl("search", "baozimh", "{}", ""), "[]");
    let out = cimoc_core::crawl("search", "baozimh", r#"{"keyword":"海贼"}"#, BAOZIMH_JS);
    assert_eq!(out, "[]");
    let (msg, _) = cimoc_core::crawler::script::last_error("baozimh").expect("应记录源错误");
    assert!(msg.contains("渲染通道未注册"), "msg = {msg}");
}
