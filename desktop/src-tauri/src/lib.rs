// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use cimoc_core::native::queue::{DownloadProgress, DownloadQueue, DownloadTask, TaskStatus};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{Emitter, Manager};

/// 本机图片代理（research #31 换代理：自用 + Android 优先）。
mod img_proxy;

/// 隐藏 webview 渲染通道（Cloudflare 防护源；pub 供 examples/render_probe 复用）。
///
/// 仅桌面端：隐藏副窗口用到的 `skip_taskbar` / `decorations` / `focused` 在 tauri 里
/// 属于 `#[cfg(desktop)]` 的构建器方法，iOS / Android 上不存在；移动端不注册渲染通道，
/// cimoc-core 会按既有路径返回「渲染通道未注册」。
#[cfg(desktop)]
pub mod render;

/// 图片代理缓存目录（setup 时解析 app cache dir 填充，代理线程里拿不到 AppHandle）。
static IMG_CACHE_DIR: OnceLock<String> = OnceLock::new();

/// 本机图片代理端口（setup 时绑定 127.0.0.1:0 后填充，前端经 img_proxy_port 读取）。
static IMG_PROXY_PORT: OnceLock<u16> = OnceLock::new();

/// 用户配置的下载目录（首次查询时由前端 init 传入，代理按 source/comicId 读下载索引）。
static DOWNLOAD_DIR: OnceLock<String> = OnceLock::new();

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

/// 本机图片代理端口（setup 时绑定后填充；前端启动时调用，用于拼图片 URL）。
#[tauri::command]
fn img_proxy_port() -> u16 {
    IMG_PROXY_PORT.get().copied().unwrap_or(0)
}

/// 初始化代理的下载目录（前端读取 settings 后调用，wayfinder #31：离线也传 url）。
#[tauri::command]
fn img_proxy_set_download_dir(dir: String) {
    let _ = DOWNLOAD_DIR.set(dir);
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        // 主窗口销毁时连带销毁隐藏渲染 webview，保持「关掉全部窗口即退出」的原有行为
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                #[cfg(desktop)]
                {
                    if let Some(rw) =
                        window.app_handle().get_webview_window(render::RENDER_LABEL)
                    {
                        let _ = rw.destroy();
                    }
                }
            }
        })
        .setup(|app| {
            if let Ok(dir) = app.path().app_cache_dir() {
                let _ = IMG_CACHE_DIR.set(dir.to_string_lossy().into_owned());
            }
            // 渲染通道注册（cimoc-core 的渲染源 fetch 经隐藏 webview 取页面；仅桌面端）
            #[cfg(desktop)]
            render::init(app.handle());
            // 本机图片代理（research #31 换代理）：绑定 127.0.0.1 随机端口，端口经
            // img_proxy_port 暴露给前端；取代自定义 scheme（Android 30s 拦截上限根因）。
            if let Ok((listener, port)) = img_proxy::bind_img_proxy() {
                let _ = IMG_PROXY_PORT.set(port);
                let cache_dir = IMG_CACHE_DIR.get().cloned().unwrap_or_default();
                let download_dir = DOWNLOAD_DIR.get().cloned().unwrap_or_default();
                tauri::async_runtime::spawn(async move {
                    img_proxy::serve(listener, cache_dir, download_dir).await;
                });
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
            img_proxy_port,
            img_proxy_set_download_dir,
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
