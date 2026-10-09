//! Hentara hentara.com 图源（脚本源，2026-09-30 新增）。
//! 解析与 op URL 构造全在源脚本 `js/sources/hentara.js`（取站点自带的静态 JSON 数据接口）；
//! 本模块只保留 Rust 侧网络请求头。图片（cdn.hentara.com）无热链校验，前端直连加载。

pub const SITE: &str = "https://hentara.com";
pub const DATA: &str = "https://cdn.hentara.com/data";
pub const PREFIX: &str = "hentara-";

/// 常规请求头（浏览器 UA；站点与数据 CDN 均无 IP 风控）。
pub fn headers() -> Vec<(&'static str, &'static str)> {
    vec![
        (
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        ),
        (
            "Accept",
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        ),
        ("Accept-Language", "en-US,en;q=0.9"),
    ]
}
