//! 本机 HTTP 图片代理（research #31 换代理：自用 + Android 优先）。
//!
//! 前端把热链域图片 src 重写为 `http://127.0.0.1:<port>/img?url=..&ref=..`，本地下载
//! 文件路径重写为 `http://127.0.0.1:<port>/img?path=..`；本模块在 127.0.0.1 起 hyper
//! HTTP 服务。**单端点**：有 `path` 先读本地文件（不存在则回落到 url），否则走 url 的
//! 缓存取图（LRU + 磁盘缓存，Referer 由 cimoc-core 补）——调用方无需区分本地/缓存。
//!
//! 相比自定义 scheme（`cimoc-img://`）：绕过 wry `shouldInterceptRequest` 的 30s 响应上限
//! （Android 图片首次下载慢即超时落空的根因，wry#1551）；请求是普通 HTTP，走真实 socket。
//! iOS 元素卸载仍会 abort 请求 → 前端 ProxyImage 失败重试兜底。

use bytes::Bytes;
use cimoc_core::cache;
use cimoc_core::native::download_index;
use http_body_util::Full;
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use std::convert::Infallible;
use std::net::{Ipv4Addr, SocketAddr};
use tokio::net::TcpListener;

/// 绑定 127.0.0.1 随机端口，返回 (std listener, port)。绑定不依赖 tokio 上下文
/// （setup / 测试线程均可调用）；serve 里再转成 tokio listener。
pub fn bind_img_proxy() -> std::io::Result<(std::net::TcpListener, u16)> {
    let listener = std::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
    let port = listener.local_addr()?.port();
    listener.set_nonblocking(true)?;
    Ok((listener, port))
}

/// 常驻 accept 循环：每连接一个 task，取图放 blocking 池后返回。
pub async fn serve(std_listener: std::net::TcpListener, cache_dir: String, download_dir: String) {
    let listener = match TcpListener::from_std(std_listener) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("img proxy: failed to take over listener: {e}");
            return;
        }
    };
    loop {
        let (stream, _) = match listener.accept().await {
            Ok(s) => s,
            Err(_) => continue,
        };
        let cache_dir = cache_dir.clone();
        let download_dir = download_dir.clone();
        tokio::spawn(async move {
            let io = TokioIo::new(stream);
            let svc = service_fn(move |req| handle(req, cache_dir.clone(), download_dir.clone()));
            if let Err(e) = http1::Builder::new().serve_connection(io, svc).await {
                eprintln!("img proxy connection error: {e}");
            }
        });
    }
}

async fn handle(
    req: Request<Incoming>,
    cache_dir: String,
    download_dir: String,
) -> Result<Response<Full<Bytes>>, Infallible> {
    let uri = req.uri().to_string();
    // blocking 取图（reqwest + 磁盘 IO）挪到 blocking 池，不占 tokio worker
    let resp = tokio::task::spawn_blocking(move || handle_proxied(&uri, &cache_dir, &download_dir))
        .await
        .unwrap_or_else(|_| error_response(StatusCode::INTERNAL_SERVER_ERROR));
    Ok(resp)
}

/// 解析请求 URI（`/img?url=..&ref=..&source=..&comicId=..` 或 `/img?path=..`）→ 响应。
/// 优先级：
///   1) source+comicId+url → 读下载索引（命中直接读下载文件）
///   2) path → 读本地绝对路径（旧数据兼容）
///   3) url → 走缓存取图（在线阅读）
fn handle_proxied(uri: &str, cache_dir: &str, download_dir: &str) -> Response<Full<Bytes>> {
    let (url, referer, path, source, comic_id) = parse_img_query(uri);

    // 1) 离线阅读：source+comicId+url → 查下载索引
    if !source.is_empty() && !comic_id.is_empty() && !url.is_empty() && !download_dir.is_empty() {
        if let Some(file_path) = download_index::find_downloaded_file(download_dir, &source, &comic_id, &url) {
            if let Some(resp) = local_file_response(file_path.to_str().unwrap_or("")) {
                return resp;
            }
        }
        // 未命中索引 → 回落到缓存
    }

    // 2) 旧数据兼容：绝对路径直接读
    if !path.is_empty() {
        if let Some(resp) = local_file_response(&path) {
            return resp;
        }
        if url.is_empty() {
            return error_response(StatusCode::NOT_FOUND);
        }
    }

    // 3) 在线阅读：url → 缓存
    if url.is_empty() {
        return error_response(StatusCode::BAD_REQUEST);
    }
    match cache::fetch_image(&url, &referer, cache_dir) {
        Ok((bytes, content_type)) => Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", content_type)
            .body(Full::new(Bytes::from(bytes)))
            .unwrap_or_else(|_| error_response(StatusCode::INTERNAL_SERVER_ERROR)),
        Err(_) => error_response(StatusCode::BAD_GATEWAY),
    }
}

fn parse_img_query(uri: &str) -> (String, String, String, String, String) {
    let query = uri.split('?').nth(1).unwrap_or("");
    let mut url = String::new();
    let mut referer = String::new();
    let mut path = String::new();
    let mut source = String::new();
    let mut comic_id = String::new();
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            let value = urlencoding::decode(v).unwrap_or_default().into_owned();
            match k {
                "url" => url = value,
                "ref" => referer = value,
                "path" => path = value,
                "source" => source = value,
                "comicId" => comic_id = value,
                _ => {}
            }
        }
    }
    (url, referer, path, source, comic_id)
}

fn local_file_response(path: &str) -> Option<Response<Full<Bytes>>> {
    let bytes = std::fs::read(path).ok()?;
    Some(
        Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", content_type_for(path))
            .body(Full::new(Bytes::from(bytes)))
            .unwrap_or_else(|_| error_response(StatusCode::INTERNAL_SERVER_ERROR)),
    )
}

fn content_type_for(path: &str) -> &'static str {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".jpeg") || lower.ends_with(".jpg") {
        "image/jpeg"
    } else {
        "application/octet-stream"
    }
}

fn error_response(status: StatusCode) -> Response<Full<Bytes>> {
    Response::builder()
        .status(status)
        .body(Full::new(Bytes::new()))
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::sync::{Arc, Mutex};

    fn temp_cache_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "cimoc-img-proxy-test-{}-{}",
            tag,
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    /// 极简上游 HTTP 服务器：记录收到的原始请求头，返回固定图片体。
    fn spawn_upstream(
        body: &'static [u8],
        content_type: &'static str,
    ) -> (String, Arc<Mutex<Vec<String>>>) {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
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

    /// 在本 tokio runtime 里起代理，返回端口。
    fn spawn_proxy(rt: &tokio::runtime::Runtime, cache_dir: &str, download_dir: &str) -> u16 {
        let (listener, port) = bind_img_proxy().unwrap();
        let cd = cache_dir.to_string();
        let dd = download_dir.to_string();
        rt.spawn(serve(listener, cd, dd));
        port
    }

    /// 对代理发裸 HTTP GET，返回 (status, 小写响应头, body 字节)。
    fn http_get(port: u16, path: &str) -> (u16, String, Vec<u8>) {
        let mut stream = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
        let req = format!(
            "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
        );
        stream.write_all(req.as_bytes()).unwrap();
        let mut buf = Vec::new();
        stream.read_to_end(&mut buf).unwrap();
        let split = buf
            .windows(4)
            .position(|w| w == b"\r\n\r\n")
            .expect("http response with headers");
        let head = String::from_utf8_lossy(&buf[..split]).to_string();
        let status: u16 = head
            .split_whitespace()
            .nth(1)
            .unwrap_or("")
            .parse()
            .unwrap_or(0);
        (status, head.to_lowercase(), buf[split + 4..].to_vec())
    }

    #[test]
    fn parse_img_query_extracts_url_and_ref() {
        let uri = "/img?url=https%3A%2F%2Fs.pstatic.net%2Fa.webp&ref=https%3A%2F%2Fwww.webtoons.com%2F";
        let (url, referer, path, source, comic_id) = parse_img_query(uri);
        assert_eq!(url, "https://s.pstatic.net/a.webp");
        assert_eq!(referer, "https://www.webtoons.com/");
        assert_eq!(path, "");
        assert_eq!(source, "");
        assert_eq!(comic_id, "");
    }

    #[test]
    fn parse_img_query_extracts_local_path() {
        let uri = "/img?path=%2FUsers%2Fme%2FDownloads%2Fcimoc%2Fwebtoons%2Fc1%2Fchapter_1%2F0.jpg";
        let (url, referer, path, source, comic_id) = parse_img_query(uri);
        assert_eq!(url, "");
        assert_eq!(referer, "");
        assert_eq!(path, "/Users/me/Downloads/cimoc/webtoons/c1/chapter_1/0.jpg");
        assert_eq!(source, "");
        assert_eq!(comic_id, "");
    }

    #[test]
    fn parse_img_query_missing_params_empty() {
        let (url, referer, path, source, comic_id) = parse_img_query("/img?x=1");
        assert_eq!(url, "");
        assert_eq!(referer, "");
        assert_eq!(path, "");
        assert_eq!(source, "");
        assert_eq!(comic_id, "");
    }

    #[test]
    fn parse_img_query_extracts_source_and_comic_id() {
        let uri = "/img?url=https%3A%2F%2Fa.com%2Fx.jpg&source=webtoons&comicId=123";
        let (url, referer, path, source, comic_id) = parse_img_query(uri);
        assert_eq!(url, "https://a.com/x.jpg");
        assert_eq!(referer, "");
        assert_eq!(path, "");
        assert_eq!(source, "webtoons");
        assert_eq!(comic_id, "123");
    }

    #[test]
    fn content_type_by_extension() {
        assert_eq!(content_type_for("/x/a.jpg"), "image/jpeg");
        assert_eq!(content_type_for("/x/a.webp"), "image/webp");
        assert_eq!(content_type_for("/x/a.png"), "image/png");
        assert_eq!(content_type_for("/x/a"), "application/octet-stream");
    }

    /// 代理取热链图：带 Referer 转上游、透传 content-type 与字节、落盘后二次请求走缓存。
    #[test]
    fn proxy_serves_img_with_referer_and_cache() {
        const BODY: &[u8] = b"proxy-webp-bytes";
        let (upstream, requests) = spawn_upstream(BODY, "image/webp");
        let dir = temp_cache_dir("img");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let port = spawn_proxy(&rt, dir.to_str().unwrap(), "");

        let path = format!("/img?url={}&ref={}", urlencoding::encode(&upstream), "https://www.webtoons.com/");
        let (status, head, body) = http_get(port, &path);
        assert_eq!(status, 200);
        assert!(head.contains("content-type: image/webp"), "head: {head}");
        assert_eq!(body, BODY);
        // 上游收到的请求带 Referer
        let req0 = requests.lock().unwrap()[0].to_lowercase();
        assert!(req0.contains("referer: https://www.webtoons.com/"));

        // 二次请求：命中磁盘缓存，不再打上游
        let (status2, _, body2) = http_get(port, &path);
        assert_eq!(status2, 200);
        assert_eq!(body2, BODY);
        assert_eq!(requests.lock().unwrap().len(), 1);
        drop(rt);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 代理读本地文件（/img?path=），缺失且无 url 返回 404。
    #[test]
    fn proxy_serves_local_file_and_404() {
        let dir = temp_cache_dir("file");
        std::fs::create_dir_all(&dir).unwrap();
        let img = dir.join("0.png");
        std::fs::write(&img, b"png-bytes").unwrap();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let port = spawn_proxy(&rt, dir.to_str().unwrap(), "");

        let path = format!("/img?path={}", urlencoding::encode(img.to_str().unwrap()));
        let (status, head, body) = http_get(port, &path);
        assert_eq!(status, 200);
        assert!(head.contains("content-type: image/png"));
        assert_eq!(body, b"png-bytes");

        let missing = format!("/img?path={}", urlencoding::encode("/no/such/file.jpg"));
        let (status404, _, _) = http_get(port, &missing);
        assert_eq!(status404, 404);
        drop(rt);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 本地文件缺失但有 url → 回落到缓存取图（本地优先，否则走缓存；合并端点语义）。
    #[test]
    fn proxy_local_missing_falls_back_to_cache() {
        const BODY: &[u8] = b"fallback-bytes";
        let (upstream, requests) = spawn_upstream(BODY, "image/png");
        let dir = temp_cache_dir("fallback");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let port = spawn_proxy(&rt, dir.to_str().unwrap(), "");
        let path = format!(
            "/img?path={}&url={}",
            urlencoding::encode("/no/such/file.jpg"),
            urlencoding::encode(&upstream)
        );
        let (status, _, body) = http_get(port, &path);
        assert_eq!(status, 200);
        assert_eq!(body, BODY);
        assert_eq!(requests.lock().unwrap().len(), 1);
        drop(rt);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn proxy_bad_query_returns_400() {
        let dir = temp_cache_dir("bad");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let port = spawn_proxy(&rt, dir.to_str().unwrap(), "");
        let (status, _, _) = http_get(port, "/img?x=1");
        assert_eq!(status, 400);
        drop(rt);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 离线阅读：source+comicId+url → 查下载索引命中直接读文件
    #[test]
    fn proxy_download_index_hit() {
        let dir = temp_cache_dir("download_idx");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let port = spawn_proxy(&rt, dir.to_str().unwrap(), dir.to_str().unwrap());

        // 创建下载目录结构
        let comic_path = dir.join("webtoons").join("comic-a").join("chapter_1");
        std::fs::create_dir_all(&comic_path).unwrap();
        std::fs::write(comic_path.join("0.jpg"), b"downloaded-jpg").unwrap();

        // 记录索引
        download_index::record_download(
            dir.to_str().unwrap(),
            "webtoons",
            "comic-a",
            "https://example.com/ch1/0.jpg",
            "chapter_1/0.jpg",
        );

        let path = "/img?url=https%3A%2F%2Fexample.com%2Fch1%2F0.jpg&source=webtoons&comicId=comic-a";
        let (status, head, body) = http_get(port, path);
        assert_eq!(status, 200);
        assert!(head.contains("content-type: image/jpeg"));
        assert_eq!(body, b"downloaded-jpg");
        drop(rt);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 离线阅读：下载索引未命中 → 回落到缓存取图
    #[test]
    fn proxy_download_index_miss_falls_back_to_cache() {
        const BODY: &[u8] = b"fallback-from-cache";
        let (upstream, requests) = spawn_upstream(BODY, "image/png");
        let dir = temp_cache_dir("download_miss");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let port = spawn_proxy(&rt, dir.to_str().unwrap(), dir.to_str().unwrap());

        // 不记录索引，直接用 source+comicId+url 请求
        let path = format!(
            "/img?url={}&source=webtoons&comicId=comic-x",
            urlencoding::encode(&upstream)
        );
        let (status, _, body) = http_get(port, &path);
        assert_eq!(status, 200);
        assert_eq!(body, BODY);
        assert_eq!(requests.lock().unwrap().len(), 1);
        drop(rt);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
