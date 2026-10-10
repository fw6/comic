//! 源适配器注册表。
//!
//! 一个漫画源在 Rust 侧的全部知识——网络请求头、ctx 派生、隐藏字段提取、是否走渲染通道、
//! 默认脚本、图片热链对、最近错误——收在 `crawler/sources/` 的一个文件里，以 sourceId
//! 注册进本模块的 [`SOURCES`]。
//!
//! 调用方（`crawler::dispatch`、`script::run`、`js::sources`、命令层的内置源清单）只按
//! sourceId 查这张表，不再按源分支。新增一个源 = 加一个文件 + 在 [`SOURCES`] 里加一行。

mod baozimh;
mod copymanga;
mod dongman;
mod hentara;
mod kxmanhua;
mod mangadex;
mod manhuagui;
mod nnhanman;
mod webtoons;

use crate::util::now_ms;
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::sync::Mutex;

/// 图片热链对：CDN 域名 → 需带上的 Referer（图片代理与下载共用）。
pub struct HotlinkReferer {
    pub domain: &'static str,
    pub referer: &'static str,
}

/// 一个源最近一次错误的存放处（每个源文件里放一个 `static`）。
pub struct ErrorSlot(Mutex<Option<(String, u64)>>);

impl Default for ErrorSlot {
    fn default() -> Self {
        Self::new()
    }
}

impl ErrorSlot {
    pub const fn new() -> Self {
        ErrorSlot(Mutex::new(None))
    }

    /// 记录该源最近一次错误（覆盖旧值）。
    pub fn record(&self, message: &str) {
        *self.0.lock().unwrap() = Some((message.to_string(), now_ms()));
    }

    /// op 成功时清除该源最近错误（前端错误行不显示陈旧错误）。
    pub fn clear(&self) {
        *self.0.lock().unwrap() = None;
    }

    /// 读取（不清空）最近错误。
    pub fn get(&self) -> Option<(String, u64)> {
        self.0.lock().unwrap().clone()
    }
}

/// 一个漫画源在 Rust 侧的知识。方法都有默认实现，源只覆盖自己需要的那几个。
pub trait Source: Send + Sync {
    /// 显示名（内置源的种子名；源仓库 index.json 可覆盖）。
    fn title(&self) -> &'static str;
    /// 内置脚本源码（随 app 打包；已装源可被源仓库的更新覆盖）。
    fn script(&self) -> &'static str;
    /// 该源是否整源经渲染通道取页面（带 JS 挑战 / 客户端环境校验的源）。
    fn render_channel(&self) -> bool {
        false
    }
    /// 网络请求头。op 与 ctx 可影响（如 webtoons images 按 ctx 的 seriesUrl 带 Referer）。
    fn headers(&self, _op: &str, _ctx: &Value) -> Vec<(&'static str, String)> {
        Vec::new()
    }
    /// op 上下文：交给脚本的派生值（缓存/网络派生的 URL、章节 id 等）。
    fn ctx(&self, _op: &str, _payload: &Value) -> Value {
        Value::Object(Map::new())
    }
    /// Rust 侧直接实现的 op（不经脚本）。None = 交给脚本。
    fn native_op(&self, _op: &str, _payload: &Value) -> Option<(String, bool)> {
        None
    }
    /// 解析结果的后处理（提取隐藏字段进缓存等）。默认原样返回。
    fn post_process(&self, _op: &str, json: &str) -> String {
        json.to_string()
    }
    /// 图片热链对（前端图片代理与下载 Referer 用）。
    fn hotlink_referers(&self) -> &'static [HotlinkReferer] {
        &[]
    }
    /// 该源的错误存放处。
    fn errors(&self) -> &'static ErrorSlot;
}

/// 内置源注册表：sourceId → adapter。顺序即前端源清单的显示顺序，首个为默认源。
pub static SOURCES: &[(&str, &dyn Source)] = &[
    ("mangadex", &mangadex::MANGADEX),
    ("webtoons", &webtoons::WEBTOONS),
    ("copymanga", &copymanga::COPYMANGA),
    ("dongman", &dongman::DONGMAN),
    ("manhuagui", &manhuagui::MANHUAGUI),
    ("baozimh", &baozimh::BAOZIMH),
    ("nnhanman", &nnhanman::NNHANMAN),
    ("kxmanhua", &kxmanhua::KXMANHUA),
    ("hentara", &hentara::HENTARA),
];

/// 按 sourceId 查 adapter。
pub fn get(source: &str) -> Option<&'static dyn Source> {
    SOURCES
        .iter()
        .find(|(id, _)| *id == source)
        .map(|(_, s)| *s)
}

/// op 成功时清除某源最近错误（未知 source 忽略）。
pub fn clear_error(source: &str) {
    if let Some(s) = get(source) {
        s.errors().clear();
    }
}

/// 读取某源最近错误（不清空）。
pub fn last_error(source: &str) -> Option<(String, u64)> {
    get(source)?.errors().get()
}

/// 全部源的最近错误（命令层展示用）。
pub fn all_errors() -> HashMap<String, (String, u64)> {
    SOURCES
        .iter()
        .filter_map(|(id, s)| s.errors().get().map(|e| (id.to_string(), e)))
        .collect()
}

/// payload 的 comicId（缺失为空串）。
pub fn comic_id(payload: &Value) -> &str {
    payload
        .get("comicId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
}

/// payload 的 chapterIndex（缺失为 0）。
pub fn chapter_index(payload: &Value) -> f64 {
    payload
        .get("chapterIndex")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crawler::render;

    /// 注册表里的源 id 唯一，且都能取到自己的脚本与显示名。
    #[test]
    fn every_registered_source_has_script_and_title() {
        let mut seen: Vec<&str> = Vec::new();
        for (id, src) in SOURCES {
            assert!(!seen.contains(id), "{id} 重复注册");
            seen.push(id);
            assert!(!src.script().is_empty(), "{id} 脚本为空");
            assert!(!src.title().is_empty(), "{id} 显示名为空");
            assert!(get(id).is_some(), "{id} 查不到自己");
        }
        assert!(get("nope").is_none());
    }

    /// 走渲染通道的源在 adapter 里声明（判据不再集中在一处 match）。
    #[test]
    fn render_channel_sources_are_declared_by_adapter() {
        let declared: Vec<&str> = SOURCES
            .iter()
            .filter(|(_, s)| s.render_channel())
            .map(|(id, _)| *id)
            .collect();
        assert_eq!(declared, vec!["baozimh", "nnhanman"]);
        // 渲染源的页面经通道取，普通源不走
        assert!(!get("manhuagui").unwrap().render_channel());
        assert!(!get("webtoons").unwrap().render_channel());
        // 渲染通道未注册时给出明确错误（宿主未就绪）
        assert!(render::fetch("https://example.com").is_err());
    }

    /// 错误按源自持：记录、读取、清除互不影响其它源。
    #[test]
    fn errors_are_per_source() {
        let webtoons = get("webtoons").unwrap();
        let mangadex = get("mangadex").unwrap();
        webtoons.errors().record("parse(search): boom");
        let (msg, at) = webtoons.errors().get().expect("应记录错误");
        assert!(msg.contains("boom"));
        assert!(at > 0);
        assert!(mangadex.errors().get().is_none());
        assert!(last_error("webtoons").is_some());
        assert!(last_error("mangadex").is_none());

        webtoons.errors().clear();
        assert!(last_error("webtoons").is_none());
        // 未知 source 不 panic
        clear_error("nope");
        assert!(last_error("nope").is_none());
    }

    #[test]
    fn payload_helpers_read_fields() {
        let p = serde_json::json!({"comicId": "webtoons-1571", "chapterIndex": 3.0});
        assert_eq!(comic_id(&p), "webtoons-1571");
        assert_eq!(chapter_index(&p), 3.0);
        let empty = serde_json::json!({});
        assert_eq!(comic_id(&empty), "");
        assert_eq!(chapter_index(&empty), 0.0);
    }
}
