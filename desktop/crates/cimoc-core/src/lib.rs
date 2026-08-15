//! cimoc-core：Tauri 桌面端共享的漫画核心逻辑。
//!
//! 承载爬虫引擎（`crawler`）、WebDAV/下载/本地文件 IO（`native`）与热链图片代理缓存（`cache`）。
//! 原 uniffi/JNI/Swift 绑定已随 Lynx 迁移整体移除（AGENTS.md：不做兼容层），
//! 桌面端由 `desktop/src-tauri` 的命令层以 &str API 调用。

pub mod cache;
pub mod crawler;
pub mod native;

/// 核心版本字符串。
pub fn cimoc_version() -> String {
    "cimoc-core-rust".to_string()
}

/// 爬虫引擎统一入口：返回 JSON 字符串（失败返回空 JSON）。
pub fn crawl(op: &str, source: &str, payload: &str) -> String {
    crawler::crawl(op, source, payload)
}

/// WebDAV PUT 备份：返回 JSON `{"success","status"}`。
pub fn webdav_put(
    base: &str,
    user: &str,
    password: &str,
    file_name: &str,
    content: &str,
) -> String {
    native::webdav::webdav_put(base, user, password, file_name, content)
}

/// WebDAV GET 读取备份：返回 JSON `{"ok","content","status","error"}`。
pub fn webdav_get(base: &str, user: &str, password: &str, file_name: &str) -> String {
    native::webdav::webdav_get(base, user, password, file_name)
}

/// 下载单张图片到本地目录：返回 `"true"`/`"false"`。referer 非空时带上（热链域需要）。
pub fn download_image(
    url: &str,
    dir: &str,
    comic_id: &str,
    chapter_index: i64,
    page_index: i64,
    referer: &str,
) -> String {
    native::files::download_image(url, dir, comic_id, chapter_index, page_index, referer)
}

/// 已下载章节文件列表：返回 JSON `{chapterIndex: [paths]}`。
pub fn list_downloaded(dir: &str, comic_id: &str) -> String {
    native::files::list_downloaded(dir, comic_id)
}

/// 扫描本地已下载漫画：返回 JSON `[{comicId, chapterCount}]`。
pub fn scan_local(dir: &str) -> String {
    native::files::scan_local(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_correct() {
        assert_eq!(cimoc_version(), "cimoc-core-rust");
    }
}
