//! 爬虫领域模型：与 app 侧 `src/cimoc/data/models.ts` 的 Comic/Chapter 结构一一对应。
//! 通过 serde 以 camelCase 序列化为 JSON，经 `cimoc.crawl` 方法返回给 JS 层。

use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Comic {
    pub id: String,
    pub source: String,
    pub source_title: String,
    pub title: String,
    pub author: String,
    pub intro: String,
    pub cover: String,
    /// "finish" | "serial"
    pub status: String,
    pub update_time: String,
    pub last_chapter: String,
    pub tags: Vec<String>,
    pub last_read_chapter: i32,
    pub last_read_time: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Chapter {
    /// 章节号（MangaDex 可能为小数，如 1.5；Webtoons 为整数话数）
    pub index: f64,
    pub title: String,
    pub pages: Vec<String>,
    pub downloaded: bool,
    pub read: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Detail {
    pub comic: Comic,
    pub chapters: Vec<Chapter>,
}
