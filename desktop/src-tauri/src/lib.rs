// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::borrow::Cow;
use std::sync::OnceLock;
use tauri::Manager;

/// 图片代理缓存目录（setup 时解析 app cache dir 填充，scheme 回调里拿不到 AppHandle）。
static IMG_CACHE_DIR: OnceLock<String> = OnceLock::new();

/// 爬虫引擎统一入口（转发 Rust core，返回 JSON 字符串）。
/// 阻塞式 reqwest 放入 spawn_blocking：同步命令在主线程执行，直接调用会卡死 UI。
#[tauri::command]
async fn crawl(op: String, source: String, payload: String) -> String {
    tauri::async_runtime::spawn_blocking(move || cimoc_core::crawl(&op, &source, &payload))
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn webdav_put(
    base: String,
    user: String,
    password: String,
    file_name: String,
    content: String,
) -> String {
    tauri::async_runtime::spawn_blocking(move || {
        cimoc_core::webdav_put(&base, &user, &password, &file_name, &content)
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
async fn webdav_get(base: String, user: String, password: String, file_name: String) -> String {
    tauri::async_runtime::spawn_blocking(move || {
        cimoc_core::webdav_get(&base, &user, &password, &file_name)
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
async fn download_image(
    url: String,
    dir: String,
    comic_id: String,
    chapter_index: i64,
    page_index: i64,
) -> String {
    tauri::async_runtime::spawn_blocking(move || {
        cimoc_core::download_image(&url, &dir, &comic_id, chapter_index, page_index)
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
async fn list_downloaded(dir: String, comic_id: String) -> String {
    tauri::async_runtime::spawn_blocking(move || cimoc_core::list_downloaded(&dir, &comic_id))
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn scan_local(dir: String) -> String {
    tauri::async_runtime::spawn_blocking(move || cimoc_core::scan_local(&dir))
        .await
        .unwrap_or_default()
}

#[tauri::command]
fn cimoc_version() -> String {
    cimoc_core::cimoc_version()
}

/// 热链保护图片代理（research #4 结论）：前端把 pstatic.net 等域的图片 src 重写为
/// `cimoc-img://localhost/img?url=..&ref=..`，这里转发给 cimoc-core 的缓存取图
/// （LRU + 磁盘缓存 + 复用共享 reqwest 客户端，Referer 由 cimoc_core 侧补）。
fn fetch_proxied_image(uri: &str) -> tauri::http::Response<Cow<'static, [u8]>> {
    let (url, referer) = parse_img_query(uri);
    if url.is_empty() {
        return error_response(400);
    }
    let cache_dir = IMG_CACHE_DIR.get().map(String::as_str).unwrap_or_default();
    match cimoc_core::cache::fetch_image(&url, &referer, cache_dir) {
        Ok((bytes, content_type)) => tauri::http::Response::builder()
            .status(200)
            .header("Content-Type", content_type)
            .body(Cow::Owned(bytes))
            .unwrap_or_else(|_| error_response(500)),
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
        .setup(|app| {
            if let Ok(dir) = app.path().app_cache_dir() {
                let _ = IMG_CACHE_DIR.set(dir.to_string_lossy().into_owned());
            }
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("cimoc-img", |_ctx, request, responder| {
            let uri = request.uri().to_string();
            // WKURLSchemeHandler 回调在主线程：阻塞取图挪到后台线程，否则卡死 webview。
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
