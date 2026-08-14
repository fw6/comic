// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::borrow::Cow;

/// 爬虫引擎统一入口（转发 Rust core，返回 JSON 字符串）。
#[tauri::command]
fn crawl(op: String, source: String, payload: String) -> String {
    cimoc_core::crawl(op, source, payload)
}

#[tauri::command]
fn webdav_put(
    base: String,
    user: String,
    password: String,
    file_name: String,
    content: String,
) -> String {
    cimoc_core::webdav_put(base, user, password, file_name, content)
}

#[tauri::command]
fn webdav_get(base: String, user: String, password: String, file_name: String) -> String {
    cimoc_core::webdav_get(base, user, password, file_name)
}

#[tauri::command]
fn download_image(
    url: String,
    dir: String,
    comic_id: String,
    chapter_index: i64,
    page_index: i64,
) -> String {
    cimoc_core::download_image(url, dir, comic_id, chapter_index, page_index)
}

#[tauri::command]
fn list_downloaded(dir: String, comic_id: String) -> String {
    cimoc_core::list_downloaded(dir, comic_id)
}

#[tauri::command]
fn scan_local(dir: String) -> String {
    cimoc_core::scan_local(dir)
}

#[tauri::command]
fn cimoc_version() -> String {
    cimoc_core::cimoc_version()
}

/// 热链保护图片代理（research #4 结论的骨架实现）：
/// 前端把 pstatic.net 等域的图片 src 重写为 `cimoc-img://localhost/img?url=..&ref=..`，
/// 这里用 reqwest 带 Referer 拉取字节流回传，绕过 webview 无法注入 Referer 的限制。
/// 骨架阶段不做磁盘缓存/LRU（那属于 task「Rust core 迁移」）。
fn fetch_proxied_image(uri: &str) -> tauri::http::Response<Cow<'static, [u8]>> {
    let (url, referer) = parse_img_query(uri);
    if url.is_empty() {
        return error_response(400);
    }
    let client = match reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Cimoc/0.1)")
        .build()
    {
        Ok(c) => c,
        Err(_) => return error_response(500),
    };
    match client.get(&url).header(reqwest::header::REFERER, referer).send() {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let content_type = resp
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("application/octet-stream")
                .to_string();
            let bytes = match resp.bytes() {
                Ok(b) => b.to_vec(),
                Err(_) => return error_response(502),
            };
            tauri::http::Response::builder()
                .status(status)
                .header("Content-Type", content_type)
                .body(Cow::Owned(bytes))
                .unwrap_or_else(|_| error_response(500))
        }
        Err(_) => error_response(502),
    }
}

fn parse_img_query(uri: &str) -> (String, String) {
    let query = uri.split('?').nth(1).unwrap_or("");
    let mut url = String::new();
    let mut referer = String::new();
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            let value = urlencoding::decode(v).unwrap_or_default().into_owned();
            match k {
                "url" => url = value,
                "ref" => referer = value,
                _ => {}
            }
        }
    }
    (url, referer)
}

fn error_response(status: u16) -> tauri::http::Response<Cow<'static, [u8]>> {
    tauri::http::Response::builder()
        .status(status)
        .body(Cow::Borrowed(&b""[..]))
        .unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    // debug-only 自动化桥（Tauri MCP 验证用，不影响 release）
    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }
    builder
        .plugin(tauri_plugin_opener::init())
        .register_asynchronous_uri_scheme_protocol("cimoc-img", |_ctx, request, responder| {
            let uri = request.uri().to_string();
            // WKURLSchemeHandler 回调在主线程：阻塞式 reqwest 必须挪到后台线程，否则卡死 webview。
            tauri::async_runtime::spawn_blocking(move || {
                responder.respond(fetch_proxied_image(&uri));
            });
        })
        .invoke_handler(tauri::generate_handler![
            crawl,
            webdav_put,
            webdav_get,
            download_image,
            list_downloaded,
            scan_local,
            cimoc_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
