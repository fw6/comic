//! 热链图片代理缓存：URL 维度内存 LRU + 磁盘持久化。
//!
//! 桌面 webview 无法为 `<img>` 注入 Referer（research #4），热链域图片经 `cimoc-img://`
//! 自定义 scheme 进入这里：带 Referer 取图（复用 `crawler::http` 的共享 reqwest 客户端），
//! 按 URL 哈希落盘，并维持一个有界内存 LRU，避免重复网络请求。
//! 自定义 scheme 响应不经过 webview HTTP 缓存，命中/落盘语义由本模块自行承担。

use crate::crawler::http;
use base64::Engine;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

/// 内存 LRU 上限（条数级；逐出后下次回落到磁盘缓存）。
const LRU_CAP: usize = 128;

type Entry = (Vec<u8>, String); // (bytes, content_type)

#[derive(Default)]
struct Lru {
    map: HashMap<String, Entry>,
    order: VecDeque<String>,
}

static LRU: LazyLock<Mutex<Lru>> = LazyLock::new(|| Mutex::new(Lru::default()));

/// 热链图片取图：内存 LRU → 磁盘缓存 → 网络（带 Referer），命中网络后写回缓存。
pub fn fetch_image(url: &str, referer: &str, cache_dir: &str) -> Result<Entry, String> {
    if let Some(entry) = lru_get(url) {
        return Ok(entry);
    }
    let (img_path, meta_path) = cache_paths(cache_dir, url);
    if let (Ok(bytes), Ok(content_type)) =
        (std::fs::read(&img_path), std::fs::read_to_string(&meta_path))
    {
        let entry = (bytes, content_type);
        lru_put(url, entry.clone());
        return Ok(entry);
    }
    let entry = http::get_bytes_with_type(url, &[("Referer", referer)])?;
    if let Some(dir) = img_path.parent() {
        let _ = std::fs::create_dir_all(dir);
        let _ = std::fs::write(&img_path, &entry.0);
        let _ = std::fs::write(&meta_path, &entry.1);
    }
    lru_put(url, entry.clone());
    Ok(entry)
}

fn lru_get(url: &str) -> Option<Entry> {
    let mut lru = LRU.lock().unwrap();
    let entry = lru.map.get(url).cloned()?;
    if let Some(pos) = lru.order.iter().position(|u| u == url) {
        lru.order.remove(pos);
    }
    lru.order.push_back(url.to_string());
    Some(entry)
}

fn lru_put(url: &str, entry: Entry) {
    let mut lru = LRU.lock().unwrap();
    if !lru.map.contains_key(url) {
        lru.order.push_back(url.to_string());
    }
    lru.map.insert(url.to_string(), entry);
    while lru.order.len() > LRU_CAP {
        if let Some(oldest) = lru.order.pop_front() {
            lru.map.remove(&oldest);
        }
    }
}

fn cache_paths(cache_dir: &str, url: &str) -> (PathBuf, PathBuf) {
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    let key = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hasher.finalize());
    let dir = Path::new(cache_dir).join("imgs");
    (
        dir.join(format!("{key}.img")),
        dir.join(format!("{key}.meta")),
    )
}
