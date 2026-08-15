import { invoke, Channel } from "@tauri-apps/api/core";

export interface Comic {
    id: string;
    source: string;
    sourceTitle: string;
    title: string;
    author: string;
    intro: string;
    cover: string;
    status: string;
    updateTime: string;
    lastChapter: string;
    tags: string[];
    lastReadChapter: number;
    lastReadTime: number;
}

export interface Chapter {
    index: number;
    title: string;
    pages: string[];
    /** 外链章节（内容托管站外，如 MangaPlus）：列表与「下一话」一律过滤（grilling #6） */
    external: boolean;
    downloaded: boolean;
    read: boolean;
}

/** 本地扫描/下载目录里的漫画条目（wayfinder #19：带 source，扁平导入为 "local"）。 */
export interface LocalComic {
    source: string;
    comicId: string;
    chapterCount: number;
}

/** 调 Rust crawl 命令：payload 编码为 JSON 字符串，返回解析后的 JSON。 */
export function crawl<T>(op: string, source: string, payload: unknown): Promise<T> {
    return invoke<string>("crawl", { op, source, payload: JSON.stringify(payload) }).then(
        (json) => JSON.parse(json) as T,
    );
}

export const cimocVersion = () => invoke<string>("cimoc_version");

/** 扫描下载目录/本地文件夹：`[{source, comicId, chapterCount}]`。 */
export const scanLocal = (dir: string) =>
    invoke<string>("scan_local", { dir }).then(
        (json) => JSON.parse(json) as LocalComic[],
    );

/** 某漫画已下载章节：`{chapterIndex: [文件路径]}`（source = "local" 走扁平布局）。 */
export const listDownloaded = (dir: string, source: string, comicId: string) =>
    invoke<string>("list_downloaded", { dir, source, comicId }).then(
        (json) => JSON.parse(json) as Record<string, string[]>,
    );

/** 某源最近一次错误（wayfinder #17：Sources 错误行 / Settings 源区）。 */

// ---------- 下载任务队列（wayfinder #20/#22/#23） ----------

export type DownloadStatus = "queued" | "downloading" | "done" | "failed" | "cancelled";

/** 进度事件载荷（grilling #22 #6）：`{taskId, status, done, total, error?}`。 */
export interface DownloadProgress {
    taskId: string;
    status: DownloadStatus;
    done: number;
    total: number;
    error?: string;
}

/** 队列快照里的任务视图（进度 + 展示字段，Downloads 页任务行）。 */
export interface DownloadTaskView extends DownloadProgress {
    source: string;
    comicId: string;
    comicTitle: string;
    chapterIndex: number;
}

/** 入队结果（grilling #22 #4/#5 去重语义）。 */
export type EnqueueResult = "queued" | "alreadyDownloaded" | "alreadyQueued";

export interface EnqueueOutcome {
    result: EnqueueResult;
    progress: DownloadProgress;
}

/** 订阅下载进度（Downloads 页挂载时调用；Channel 存 Rust State 供 worker 推送）。 */
export const subscribeDownloads = (channel: Channel<DownloadProgress>) =>
    invoke("subscribe_downloads", { channel });

/** 退订（组件卸载时清理订阅，grilling #23 #6）。 */
export const unsubscribeDownloads = () => invoke("unsubscribe_downloads");

/** 队列快照（任务视图数组，含展示字段）。 */
export const getDownloads = () =>
    invoke<string>("get_downloads").then((json) => JSON.parse(json) as DownloadTaskView[]);

/** 入队一话下载（已在磁盘 → alreadyDownloaded 不入队；重复入队 → alreadyQueued）。 */
export const enqueueDownload = (params: {
    source: string;
    comicId: string;
    comicTitle: string;
    chapterIndex: number;
    dir: string;
    referer: string;
    urls: string[];
}): Promise<EnqueueOutcome> =>
    invoke<string>("enqueue_download", params).then((json) => JSON.parse(json) as EnqueueOutcome);

/** 取消任务（排队/下载中 → cancelled）。返回最新进度或 null。 */
export const cancelDownload = (taskId: string): Promise<DownloadProgress | null> =>
    invoke<string>("cancel_download", { taskId }).then((json) =>
        json === "null" ? null : (JSON.parse(json) as DownloadProgress),
    );

/** 重试任务（failed/cancelled → 重新排队）。返回最新进度或 null。 */
export const retryDownload = (taskId: string): Promise<DownloadProgress | null> =>
    invoke<string>("retry_download", { taskId }).then((json) =>
        json === "null" ? null : (JSON.parse(json) as DownloadProgress),
    );

/** 清空已完成（done/failed/cancelled），返回移除数量。 */
export const clearDownloads = () => invoke<number>("clear_downloads");

/** 某源最近一次错误（wayfinder #17：Sources 错误行 / Settings 源区）。 */
export interface SourceError {
    message: string;
    /** unix 毫秒 */
    at: number;
}

/** 内置源脚本（debug 从磁盘读，release 内置打包）。 */
export const bundledSources = (): Promise<Record<string, string>> => invoke("bundled_sources");

/** 把 sources.json 的脚本同步进 Rust registry（启动/更新后调用）。 */
export const syncSources = (entries: Record<string, string>) =>
    invoke("sync_sources", { entries });

/** 各源最近错误：{source: {message, at}}。 */
export const sourceErrors = (): Promise<Record<string, SourceError>> => invoke("source_errors");

/** 热链保护域（research #4 结论）：重写为 cimoc-img:// 代理，其余保持直连吃 webview 缓存。 */
export function imgSrc(url: string): string {
    if (url.includes("pstatic.net")) {
        return `cimoc-img://localhost/img?url=${encodeURIComponent(url)}&ref=${encodeURIComponent("https://www.webtoons.com/")}`;
    }
    return url;
}

/** 本地文件路径 → cimoc-img:// 本地模式（wayfinder #19：Rust 读文件回字节，按扩展名给 content-type）。 */
export function localSrc(path: string): string {
    return `cimoc-img://localhost/file?path=${encodeURIComponent(path)}`;
}

// ---------- WebDAV 备份/恢复（wayfinder #24/#25：core 传输，前端组装内容） ----------

export interface WebdavPutResult {
    success: boolean;
    status: number;
}

export interface WebdavGetResult {
    ok: boolean;
    content?: string;
    status?: number;
    error?: string;
}

/** WebDAV PUT 备份文件（core webdav_put：Basic Auth）。 */
export const webdavPut = (
    base: string,
    user: string,
    password: string,
    fileName: string,
    content: string,
): Promise<WebdavPutResult> =>
    invoke<string>("webdav_put", { base, user, password, fileName, content }).then(
        (json) => JSON.parse(json) as WebdavPutResult,
    );

/** WebDAV GET 读取备份文件（core webdav_get：Basic Auth）。 */
export const webdavGet = (
    base: string,
    user: string,
    password: string,
    fileName: string,
): Promise<WebdavGetResult> =>
    invoke<string>("webdav_get", { base, user, password, fileName }).then(
        (json) => JSON.parse(json) as WebdavGetResult,
    );
