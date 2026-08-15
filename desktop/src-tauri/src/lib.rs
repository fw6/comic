// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use cimoc_core::native::queue::{DownloadProgress, DownloadQueue, DownloadTask, TaskStatus};
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{Emitter, Manager};

/// 图片代理缓存目录（setup 时解析 app cache dir 填充，scheme 回调里拿不到 AppHandle）。
static IMG_CACHE_DIR: OnceLock<String> = OnceLock::new();

/// 源脚本运行时 registry：sourceId -> script（前端从 sources.json 同步进来；
/// 未同步的源 crawl 返回空结果，见 cimoc-core 分发保护）。
struct SourceRegistry(Mutex<HashMap<String, String>>);

/// 下载队列状态（wayfinder #20/#22）：任务队列 + 前端订阅的进度 Channel。
/// Channel 绑定发起 subscribe 的 webview，随主窗口常驻（research #21）；失效则 emit 回退。
struct DownloadState {
    queue: DownloadQueue,
    channel: Option<Channel<DownloadProgress>>,
}

/// 进度推送事件名（grilling #22 #6 定案；Channel 失效时的 emit 回退）。
const DOWNLOAD_EVENT: &str = "download://progress";

/// 全局页下载并发（grilling #22 #2：全局 2 页并发、章内顺序）→ 起 2 个 worker。
const DOWNLOAD_WORKERS: usize = 2;

/// 单页失败重试次数（grilling #22 #3：单页失败自动重试 2 次，共 3 次尝试）。
const PAGE_RETRIES: usize = 3;

/// 进度推送：优先走 Channel（强类型/有序）；send 失败（webview 已销毁）则清掉并回退 emit。
fn push_progress(app: &tauri::AppHandle, p: DownloadProgress) {
    let channel = app
        .state::<Mutex<DownloadState>>()
        .lock()
        .unwrap()
        .channel
        .clone();
    if let Some(ch) = channel {
        if ch.send(p.clone()).is_ok() {
            return;
        }
        app.state::<Mutex<DownloadState>>()
            .lock()
            .unwrap()
            .channel = None;
    }
    let _ = app.emit(DOWNLOAD_EVENT, p);
}

/// 下载一个任务（一话）：章内按页顺序下载，单页失败重试 2 次；
/// 每页前检查取消（取消由 cancel 命令置状态，worker 据此中止）。
async fn run_download_task(app: tauri::AppHandle, task: DownloadTask) {
    let id = task.task_id.clone();
    push_progress(&app, task.to_progress()); // downloading
    for (i, url) in task.urls.iter().enumerate() {
        if app
            .state::<Mutex<DownloadState>>()
            .lock()
            .unwrap()
            .queue
            .is_cancelled(&id)
        {
            return; // 已取消：状态已置 cancelled，不再下载后续页
        }
        let mut ok = false;
        for _ in 0..PAGE_RETRIES {
            let (u, t) = (url.clone(), task.clone());
            let out = tauri::async_runtime::spawn_blocking(move || {
                cimoc_core::download_image(
                    &u,
                    &t.dir,
                    &t.source,
                    &t.comic_id,
                    t.chapter_index,
                    i as i64,
                    &t.referer,
                )
            })
            .await
            .unwrap_or_default();
            if out == "true" {
                ok = true;
                break;
            }
        }
        if ok {
            let p = app
                .state::<Mutex<DownloadState>>()
                .lock()
                .unwrap()
                .queue
                .mark_page_done(&id);
            if let Some(p) = p {
                push_progress(&app, p);
            }
        } else {
            let p = app
                .state::<Mutex<DownloadState>>()
                .lock()
                .unwrap()
                .queue
                .mark_failed(&id, format!("第 {} 页下载失败", i + 1));
            if let Some(p) = p {
                push_progress(&app, p);
            }
            return;
        }
    }
}

/// 常驻 worker：FIFO 领取任务并下载（并发 = worker 数，符合「全局 2 页并发、章内顺序」）。
async fn download_worker(app: tauri::AppHandle) {
    loop {
        let task = {
            let state = app.state::<Mutex<DownloadState>>();
            let mut s = state.lock().unwrap();
            s.queue.next_queued()
        };
        let Some(task) = task else {
            tokio::time::sleep(Duration::from_millis(200)).await;
            continue;
        };
        run_download_task(app.clone(), task).await;
    }
}

/// 前端订阅下载进度（Downloads 页挂载时调用；Channel 存 State 供 worker 长期持有）。
#[tauri::command]
fn subscribe_downloads(
    state: tauri::State<'_, Mutex<DownloadState>>,
    channel: Channel<DownloadProgress>,
) {
    state.lock().unwrap().channel = Some(channel);
}

/// 前端退订（Downloads 页卸载时清理，grilling #23 #6：组件生命周期清理）。
#[tauri::command]
fn unsubscribe_downloads(state: tauri::State<'_, Mutex<DownloadState>>) {
    state.lock().unwrap().channel = None;
}

/// 队列快照（Downloads 页初始加载；任务视图含展示字段）。
#[tauri::command]
fn get_downloads(state: tauri::State<'_, Mutex<DownloadState>>) -> String {
    let s = state.lock().unwrap();
    serde_json::to_string(&s.queue.snapshot()).unwrap_or_else(|_| "[]".to_string())
}

/// 入队一话下载（grilling #22）：去重 = 已在磁盘标 done 不入队；taskId 已在队列 → AlreadyQueued。
/// 返回 JSON `{"result": "queued"|"alreadyDownloaded"|"alreadyQueued", "progress": {...}}`。
#[tauri::command]
async fn enqueue_download(
    app: tauri::AppHandle,
    source: String,
    comic_id: String,
    comic_title: String,
    chapter_index: i64,
    dir: String,
    referer: String,
    urls: Vec<String>,
) -> String {
    let (s, c, d) = (source.clone(), comic_id.clone(), dir.clone());
    let already = tauri::async_runtime::spawn_blocking(move || {
        cimoc_core::chapter_downloaded(&d, &s, &c, chapter_index)
    })
    .await
    .unwrap_or(false);
    let task = DownloadTask {
        task_id: cimoc_core::task_id(&source, &comic_id, chapter_index),
        source,
        comic_id,
        comic_title,
        chapter_index,
        dir,
        referer,
        urls,
        done: 0,
        status: TaskStatus::Queued,
        error: None,
    };
    let (result, progress) = {
        let state = app.state::<Mutex<DownloadState>>();
        let mut s = state.lock().unwrap();
        s.queue.enqueue(task, already)
    };
    push_progress(&app, progress.clone());
    serde_json::json!({ "result": result.as_str(), "progress": progress }).to_string()
}

/// 取消任务（排队/下载中 → cancelled）。返回任务进度 JSON 或 `null`。
#[tauri::command]
fn cancel_download(
    app: tauri::AppHandle,
    task_id: String,
) -> String {
    let p = app
        .state::<Mutex<DownloadState>>()
        .lock()
        .unwrap()
        .queue
        .cancel(&task_id);
    if let Some(p) = p {
        push_progress(&app, p.clone());
        serde_json::to_string(&p).unwrap_or_default()
    } else {
        "null".to_string()
    }
}

/// 重试任务（failed/cancelled → 重新排队）。返回任务进度 JSON 或 `null`。
#[tauri::command]
fn retry_download(
    app: tauri::AppHandle,
    task_id: String,
) -> String {
    let p = app
        .state::<Mutex<DownloadState>>()
        .lock()
        .unwrap()
        .queue
        .retry(&task_id);
    if let Some(p) = p {
        push_progress(&app, p.clone());
        serde_json::to_string(&p).unwrap_or_default()
    } else {
        "null".to_string()
    }
}

/// 清空已完成（done/failed/cancelled），返回移除数量。
#[tauri::command]
fn clear_downloads(state: tauri::State<'_, Mutex<DownloadState>>) -> usize {
    state.lock().unwrap().queue.clear_finished()
}

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
        .manage(Mutex::new(DownloadState {
            queue: DownloadQueue::new(),
            channel: None,
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Ok(dir) = app.path().app_cache_dir() {
                let _ = IMG_CACHE_DIR.set(dir.to_string_lossy().into_owned());
            }
            // 下载队列 worker（research #21：setup 里 spawn 常驻；worker 数 = 全局页并发）
            for _ in 0..DOWNLOAD_WORKERS {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    download_worker(handle).await;
                });
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
            list_downloaded,
            scan_local,
            cimoc_version,
            subscribe_downloads,
            unsubscribe_downloads,
            get_downloads,
            enqueue_download,
            cancel_download,
            retry_download,
            clear_downloads
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
