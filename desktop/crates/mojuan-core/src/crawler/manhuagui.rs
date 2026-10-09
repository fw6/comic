//! 漫画柜 manhuagui.com 图源（脚本源，2026-08-19 新增）。
//! 解析与 op URL 构造全在源脚本 `js/sources/manhuagui.js`（含章节页 p.a.c.k.e.r
//! 解包 → path/files/sl → hamreus 图片 URL）；本模块只保留 Rust 侧网络请求头。
//! 图片（us.hamreus.com）由前端 imgSrc 代理带 Referer 拉取（api.ts）。

pub const API: &str = "https://www.manhuagui.com";
pub const PREFIX: &str = "manhuagui-";

/// 常规 HTML 请求头（浏览器 UA + 中文）。
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
    ]
}
