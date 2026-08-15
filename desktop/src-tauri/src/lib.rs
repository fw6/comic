// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tauri::Manager;

/// 图片代理缓存目录（setup 时解析 app cache dir 填充，scheme 回调里拿不到 AppHandle）。
static IMG_CACHE_DIR: OnceLock<String> = OnceLock::new();

/// 源脚本运行时 registry：sourceId -> script（前端从 sources.json 同步进来；
/// 未同步的源 crawl 返回空结果，见 cimoc-core 分发保护）。
struct SourceRegistry(Mutex<HashMap<String, String>>);

/// 爬虫引擎统一入口（转发 Rust core，返回 JSON 字符串）。
/// 阻塞式 reqwest 放入 spawn_blocking：同步命令在主线程执行，直接调用会卡死 UI。
/// 源脚本错误（#17 呈现）经 cimoc-core 错误 registry 记录，这里追加到 app 日志目录。
#[tauri::command]
async fn crawl(
    app: tauri::AppHandle,
    state: tauri::State<'_, SourceRegistry>,
    op: String,
    source: String,
    payload: String,
) -> Result<String, String> {
    let src = source.clone();
    let script = state.0.lock().unwrap().get(&source).cloned().unwrap_or_default();
    let out = tauri::async_runtime::spawn_blocking(move || {
        cimoc_core::crawl(&op, &src, &payload, &script)
    })
    .await
    .unwrap_or_default();
    if let Some((msg, at)) = cimoc_core::crawler::script::last_error(&source) {
        if let Ok(log_dir) = app.path().app_log_dir() {
            let _ = std::fs::create_dir_all(&log_dir);
            let line = format!("[{at}] {source}: {msg}\n");
            let _ = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(log_dir.join("sources.log"))
                .and_then(|f| {
                    use std::io::Write;
                    let mut w = std::io::BufWriter::new(f);
                    w.write_all(line.as_bytes())
                });
        }
    }
    Ok(out)
}

/// 内置源脚本（debug 读磁盘实现 #17 开发回路，release 用 include_str! 打包）。
#[tauri::command]
fn bundled_sources() -> HashMap<String, String> {
    let mut m = HashMap::new();
    for (id, _) in cimoc_core::js::sources::bundled() {
        if let Some(script) = cimoc_core::js::sources::load(id) {
            m.insert(id.to_string(), script);
        }
    }
    m
}

/// 前端启动/更新后把 sources.json 里的脚本同步进 registry。
#[tauri::command]
fn sync_sources(state: tauri::State<'_, SourceRegistry>, entries: HashMap<String, String>) {
    *state.0.lock().unwrap() = entries;
}

/// 各源最近一次错误（Sources 错误行 / Settings 源区展示，wayfinder #17）。
#[tauri::command]
fn source_errors() -> HashMap<String, serde_json::Value> {
    cimoc_core::crawler::script::all_errors()
        .into_iter()
        .map(|(source, (message, at))| (source, serde_json::json!({ "message": message, "at": at })))
        .collect()
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
    source: String,
    comic_id: String,
    chapter_index: i64,
    page_index: i64,
    referer: String,
) -> String {
    tauri::async_runtime::spawn_blocking(move || {
        cimoc_core::download_image(
            &url,
            &dir,
            &source,
            &comic_id,
            chapter_index,
            page_index,
            &referer,
        )
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
async fn list_downloaded(dir: String, source: String, comic_id: String) -> String {
    tauri::async_runtime::spawn_blocking(move || {
        cimoc_core::list_downloaded(&dir, &source, &comic_id)
    })
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

/// 热链保护图片代理 + 本地文件读取（research #4 / wayfinder #19）。
/// 前端把 pstatic.net 等域的图片 src 重写为 `cimoc-img://localhost/img?url=..&ref=..`，
/// 或把本地下载文件路径重写为 `cimoc-img://localhost/file?path=..`；这里转发给
/// cimoc-core 的缓存取图（LRU + 磁盘缓存，Referer 由 cimoc_core 侧补）或直接读本地文件。
fn fetch_proxied_image(uri: &str) -> tauri::http::Response<Cow<'static, [u8]>> {
    let (url, referer, path) = parse_img_query(uri);
    if !path.is_empty() {
        return local_file_response(&path);
    }
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

fn parse_img_query(uri: &str) -> (String, String, String) {
    let query = uri.split('?').nth(1).unwrap_or("");
    let mut url = String::new();
    let mut referer = String::new();
    let mut path = String::new();
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            let value = urlencoding::decode(v).unwrap_or_default().into_owned();
            match k {
                "url" => url = value,
                "ref" => referer = value,
                "path" => path = value,
                _ => {}
            }
        }
    }
    (url, referer, path)
}

fn local_file_response(path: &str) -> tauri::http::Response<Cow<'static, [u8]>> {
    match std::fs::read(path) {
        Ok(bytes) => tauri::http::Response::builder()
            .status(200)
            .header("Content-Type", content_type_for(path))
            .body(Cow::Owned(bytes))
            .unwrap_or_else(|_| error_response(500)),
        Err(_) => error_response(404),
    }
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
        .manage(SourceRegistry(Mutex::new(HashMap::new())))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
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
            bundled_sources,
            sync_sources,
            source_errors,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_img_query_extracts_url_and_ref() {
        let uri = "cimoc-img://localhost/img?url=https%3A%2F%2Fs.pstatic.net%2Fa.webp&ref=https%3A%2F%2Fwww.webtoons.com%2F";
        let (url, referer, path) = parse_img_query(uri);
        assert_eq!(url, "https://s.pstatic.net/a.webp");
        assert_eq!(referer, "https://www.webtoons.com/");
        assert_eq!(path, "");
    }

    #[test]
    fn parse_img_query_extracts_local_path() {
        let uri = "cimoc-img://localhost/file?path=%2FUsers%2Fme%2FDownloads%2Fcimoc%2Fwebtoons%2Fc1%2Fchapter_1%2F0.jpg";
        let (url, referer, path) = parse_img_query(uri);
        assert_eq!(url, "");
        assert_eq!(referer, "");
        assert_eq!(path, "/Users/me/Downloads/cimoc/webtoons/c1/chapter_1/0.jpg");
    }

    #[test]
    fn parse_img_query_missing_params_empty() {
        let (url, referer, path) = parse_img_query("cimoc-img://localhost/img?x=1");
        assert_eq!(url, "");
        assert_eq!(referer, "");
        assert_eq!(path, "");
    }

    #[test]
    fn content_type_by_extension() {
        assert_eq!(content_type_for("/x/a.jpg"), "image/jpeg");
        assert_eq!(content_type_for("/x/a.webp"), "image/webp");
        assert_eq!(content_type_for("/x/a.png"), "image/png");
        assert_eq!(content_type_for("/x/a"), "application/octet-stream");
    }
}
