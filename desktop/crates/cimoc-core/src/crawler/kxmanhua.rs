//! 开心看漫画 kxmanhua.com 图源（脚本源，2026-09-30 新增）。
//! 解析与 op URL 构造全在源脚本 `js/sources/kxmanhua.js`；取数经渲染通道。
//! 图片（img.imh99.top）无热链校验，前端直连加载，不经 img 代理。

pub const API: &str = "https://kxmanhua.com";
pub const PREFIX: &str = "kxmanhua-";
