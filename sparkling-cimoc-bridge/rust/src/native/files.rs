//! 本地下载 / 文件 IO（移植自旧 DownloadModule / LocalModule）。
//! 目录路径由原生侧传入（Android getExternalFilesDir/download，iOS Documents/download）。

use crate::crawler::http;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

const CHROME_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

fn chapter_dir_name(index: i64) -> String {
    format!("chapter_{}", index)
}

fn chapter_index_from_dir_name(name: &str) -> Option<i64> {
    name.strip_prefix("chapter_")?.parse().ok()
}

/// 取 URL 最后一个 '.' 后的后缀（最多 5 字符，无 '.' 时回退 "jpg"），对应 Kotlin substringAfterLast('.', "jpg").take(5)。
fn extension_from_url(url: &str) -> String {
    let after = match url.rfind('.') {
        Some(i) => &url[i + 1..],
        None => "jpg",
    };
    let taken: String = after.chars().take(5).collect();
    if taken.is_empty() {
        "jpg".to_string()
    } else {
        taken
    }
}

/// 下载单张图片到 `<dir>/<comicId>/chapter_<n>/<page>.<ext>`，返回 `"true"`/`"false"`。
pub fn download_image(url: &str, dir: &str, comic_id: &str, chapter_index: i64, page_index: i64) -> String {
    let bytes = match http::get_bytes(url, &[("User-Agent", CHROME_UA)]) {
        Ok(b) => b,
        Err(_) => return "false".to_string(),
    };
    let chapter_dir = Path::new(dir).join(comic_id).join(chapter_dir_name(chapter_index));
    if fs::create_dir_all(&chapter_dir).is_err() {
        return "false".to_string();
    }
    let file = chapter_dir.join(format!("{}.{}", page_index, extension_from_url(url)));
    match fs::write(&file, bytes) {
        Ok(_) => "true".to_string(),
        Err(_) => "false".to_string(),
    }
}

/// 已下载章节文件列表：`{chapterIndex: [absolutePaths]}`（按文件名排序）。
pub fn list_downloaded(dir: &str, comic_id: &str) -> String {
    let comic_dir = Path::new(dir).join(comic_id);
    let mut map = serde_json::Map::new();
    if let Ok(entries) = fs::read_dir(&comic_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            let Some(index) = chapter_index_from_dir_name(&name) else {
                continue;
            };
            let mut files: Vec<String> = fs::read_dir(&path)
                .map(|it| {
                    it.flatten()
                        .map(|f| f.path().to_string_lossy().to_string())
                        .collect()
                })
                .unwrap_or_default();
            files.sort();
            if !files.is_empty() {
                map.insert(
                    index.to_string(),
                    Value::Array(files.into_iter().map(Value::String).collect()),
                );
            }
        }
    }
    Value::Object(map).to_string()
}

/// 扫描本地已下载漫画：`[{comicId, chapterCount}]`。
pub fn scan_local(dir: &str) -> String {
    let base = Path::new(dir);
    let mut arr = Vec::new();
    if let Ok(entries) = fs::read_dir(base) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let comic_id = entry.file_name().to_string_lossy().to_string();
            let count = fs::read_dir(&path).map(|it| it.count()).unwrap_or(0);
            arr.push(json!({ "comicId": comic_id, "chapterCount": count }));
        }
    }
    Value::Array(arr).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cimoc-test-{}-{}", tag, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn extension_from_url_matches_kotlin() {
        assert_eq!(extension_from_url("https://x/a.jpg?type=q90"), "jpg?t");
        assert_eq!(extension_from_url("https://x/a.png"), "png");
        assert_eq!(extension_from_url("https://x/novalue"), "jpg");
    }

    #[test]
    fn scan_and_list_roundtrip() {
        let dir = temp_dir("scan");
        let _ = fs::remove_dir_all(&dir);
        // 造两个漫画目录：comic-a 有 chapter_1/chapter_2，comic-b 有 chapter_3
        fs::create_dir_all(dir.join("comic-a").join("chapter_1")).unwrap();
        fs::create_dir_all(dir.join("comic-a").join("chapter_2")).unwrap();
        fs::create_dir_all(dir.join("comic-b").join("chapter_3")).unwrap();
        fs::write(dir.join("comic-a").join("chapter_1").join("0.jpg"), b"x").unwrap();
        fs::write(dir.join("comic-a").join("chapter_2").join("0.png"), b"y").unwrap();
        // 额外一个非 chapter_ 前缀的目录应被忽略
        fs::create_dir_all(dir.join("comic-a").join("misc")).unwrap();

        let scanned: Vec<Value> = serde_json::from_str(&scan_local(dir.to_str().unwrap())).unwrap();
        let mut ids: Vec<&str> = scanned.iter().map(|c| c["comicId"].as_str().unwrap()).collect();
        ids.sort();
        assert_eq!(ids, vec!["comic-a", "comic-b"]);
        let a = scanned.iter().find(|c| c["comicId"] == "comic-a").unwrap();
        assert_eq!(a["chapterCount"], 3); // chapter_1 + chapter_2 + misc

        let listed: Value = serde_json::from_str(&list_downloaded(dir.to_str().unwrap(), "comic-a")).unwrap();
        assert_eq!(listed["1"].as_array().unwrap().len(), 1);
        assert_eq!(listed["2"].as_array().unwrap().len(), 1);
        assert!(listed.get("3").is_none()); // misc 不是 chapter_ 前缀

        let _ = fs::remove_dir_all(&dir);
    }
}
