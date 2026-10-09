//! 开心看漫画 kxmanhua.com 图源（脚本源，2026-09-30 新增）。
//! 解析与 op URL 构造全在源脚本 `js/sources/kxmanhua.js`；本模块只保留 Rust 侧网络请求头。
//! 图片（img.imh99.top）无热链校验，前端直连加载，不经 img 代理。

pub const API: &str = "https://kxmanhua.com";
pub const PREFIX: &str = "kxmanhua-";

/// 常规 HTML 请求头（浏览器 UA + 中文 + 站内 Referer）。
pub fn headers() -> Vec<(&'static str, &'static str)> {
    vec![
        (
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        ),
        (
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ),
        ("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8"),
        ("Referer", "https://kxmanhua.com/"),
    ]
}
