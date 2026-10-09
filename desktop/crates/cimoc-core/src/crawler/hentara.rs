//! Hentara hentara.com 图源（脚本源，2026-09-30 新增）。
//! 解析与 op URL 构造全在源脚本 `js/sources/hentara.js`（取站点自带的静态 JSON 数据接口）；
//! 取数经渲染通道。图片（cdn.hentara.com）无热链校验，前端直连加载。

pub const SITE: &str = "https://hentara.com";
pub const DATA: &str = "https://cdn.hentara.com/data";
pub const PREFIX: &str = "hentara-";
