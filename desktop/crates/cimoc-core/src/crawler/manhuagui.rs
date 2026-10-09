//! 漫画柜 manhuagui.com 图源（脚本源，2026-08-19 新增）。
//! 解析与 op URL 构造全在源脚本 `js/sources/manhuagui.js`（含章节页 p.a.c.k.e.r
//! 解包 → path/files/sl → hamreus 图片 URL）；取数经渲染通道。
//! 图片（us.hamreus.com）由前端 imgSrc 代理带 Referer 拉取（api.ts）。

pub const API: &str = "https://www.manhuagui.com";
pub const PREFIX: &str = "manhuagui-";
