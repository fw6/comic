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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::{Arc, Mutex};

    fn temp_cache_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "cimoc-cache-test-{}-{}",
            tag,
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    /// 极简本地 HTTP 服务器：记录收到的原始请求头，返回固定图片体。
    fn spawn_server(
        body: &'static [u8],
        content_type: &'static str,
    ) -> (String, Arc<Mutex<Vec<String>>>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
        let addr = listener.local_addr().unwrap();
        let requests = Arc::new(Mutex::new(Vec::<String>::new()));
        let reqs = Arc::clone(&requests);
        std::thread::spawn(move || {
            for stream in listener.incoming().take(10) {
                let Ok(mut stream) = stream else { break };
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                reqs.lock()
                    .unwrap()
                    .push(String::from_utf8_lossy(&buf[..n]).to_string());
                let head = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    content_type,
                    body.len()
                );
                let _ = stream.write_all(head.as_bytes());
                let _ = stream.write_all(body);
                let _ = stream.flush();
            }
        });
        (format!("http://{addr}/img.webp"), requests)
    }

    #[test]
    fn cold_fetch_goes_to_network_with_referer_and_persists() {
        const BODY: &[u8] = b"fake-webp-bytes";
        let (url, requests) = spawn_server(BODY, "image/webp");
        let dir = temp_cache_dir("cold");
        let (bytes, content_type) =
            fetch_image(&url, "https://www.webtoons.com/", dir.to_str().unwrap()).unwrap();
        assert_eq!(bytes, BODY);
        assert_eq!(content_type, "image/webp");
        // reqwest 可能以小写 header 名发送，断言大小写不敏感
        let head = requests.lock().unwrap()[0].to_lowercase();
        assert!(head.contains("referer: https://www.webtoons.com/"));
        // 磁盘缓存：img + meta 两个文件落盘
        assert_eq!(std::fs::read_dir(dir.join("imgs")).unwrap().count(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn repeat_fetch_served_from_lru_without_network() {
        const BODY: &[u8] = b"lru-bytes";
        let (url, requests) = spawn_server(BODY, "image/png");
        let dir = temp_cache_dir("lru");
        for _ in 0..2 {
            let (bytes, _) = fetch_image(&url, "ref", dir.to_str().unwrap()).unwrap();
            assert_eq!(bytes, BODY);
        }
        assert_eq!(requests.lock().unwrap().len(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn disk_hit_after_lru_clear_avoids_network() {
        const BODY: &[u8] = b"disk-bytes";
        let (url, requests) = spawn_server(BODY, "image/jpeg");
        let dir = temp_cache_dir("disk");
        fetch_image(&url, "ref", dir.to_str().unwrap()).unwrap();
        // 清空进程内 LRU，验证回落到磁盘缓存而不走网络
        LRU.lock().unwrap().map.clear();
        LRU.lock().unwrap().order.clear();
        let (bytes, _) = fetch_image(&url, "ref", dir.to_str().unwrap()).unwrap();
        assert_eq!(bytes, BODY);
        assert_eq!(requests.lock().unwrap().len(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
