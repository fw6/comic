/**
 * 原生桥封装：将 Sparkling 方法包（sparkling-cimoc-bridge / sparkling-storage）的 callback 风格 API 转换为 Promise。
 * 方法包基于 pipe 协议：回调收到 {code, msg, data}，code === 1 表示成功，data 为结果模型字段。
 * 导出签名与旧 NativeModule 桥保持一致，service.ts / screens 无需改动。
 */
import {
    downloadChapter as bridgeDownloadChapter,
    listDownloadedChapters as bridgeListDownloadedChapters,
    pickFolder as bridgePickFolder,
    scanLocalComics as bridgeScanLocalComics,
    webdavGetFile as bridgeWebdavGetFile,
    webdavPutFile as bridgeWebdavPutFile,
    rustVersion as bridgeRustVersion,
    crawl as bridgeCrawl,
    type DownloadChapterResponse,
    type ListDownloadedChaptersResponse,
    type PickFolderResponse,
    type PipeResult,
    type ScanLocalComicsResponse,
    type WebdavGetFileResponse,
    type WebdavPutFileResponse,
    type RustVersionResponse,
    type CrawlResponse,
} from 'sparkling-cimoc-bridge';
import { getItem, setItem } from 'sparkling-storage';

function toPromise<T>(
    call: (cb: (result: PipeResult<T>) => void) => void,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        try {
            call((result) => {
                if (result.code === 1) {
                    resolve(result.data as T);
                } else {
                    reject(
                        new Error(
                            result.msg ||
                                `cimoc bridge call failed (code ${result.code})`,
                        ),
                    );
                }
            });
        } catch (e) {
            reject(e as Error);
        }
    });
}

// --- Storage（官方 sparkling-storage，值为 JSON 字符串） ---
export const storeSet = (key: string, value: string): Promise<boolean> =>
    new Promise<boolean>((resolve, reject) => {
        setItem({ key, data: value }, (r) => {
            if (r.code === 1) resolve(true);
            else
                reject(
                    new Error(r.msg || `storage.setItem failed (code ${r.code})`),
                );
        });
    });

export const storeGet = (key: string): Promise<string> =>
    new Promise<string>((resolve, reject) => {
        getItem({ key }, (r) => {
            if (r.code === 1)
                resolve((r.data?.data as string | undefined) ?? '');
            else
                reject(
                    new Error(r.msg || `storage.getItem failed (code ${r.code})`),
                );
        });
    });

// --- Download ---
export const downloadImage = (
    url: string,
    comicId: string,
    chapterIndex: number,
    pageIndex: number,
): Promise<boolean> =>
    toPromise<DownloadChapterResponse>((cb) =>
        bridgeDownloadChapter({ url, comicId, chapterIndex, pageIndex }, cb),
    ).then((r) => r.success);

export const listDownloaded = (
    comicId: string,
): Promise<Record<string, string[]>> =>
    toPromise<ListDownloadedChaptersResponse>((cb) =>
        bridgeListDownloadedChapters({ comicId }, cb),
    ).then(
        (r) => JSON.parse(r.chaptersJson) as Record<string, string[]>,
    );

// --- Local ---
export const scanLocalComics = (): Promise<
    Array<{ comicId: string; chapterCount: number }>
> =>
    toPromise<ScanLocalComicsResponse>((cb) => bridgeScanLocalComics(cb)).then(
        (r) =>
            JSON.parse(r.comicsJson) as Array<{
                comicId: string;
                chapterCount: number;
            }>,
    );

export const pickFolder = (): Promise<boolean> =>
    toPromise<PickFolderResponse>((cb) => bridgePickFolder(cb)).then(
        (r) => r.success,
    );

// --- WebDav ---
export const webdavPut = (
    base: string,
    user: string,
    password: string,
    fileName: string,
    content: string,
): Promise<boolean> =>
    toPromise<WebdavPutFileResponse>((cb) =>
        bridgeWebdavPutFile({ base, user, password, fileName, content }, cb),
    ).then((r) => r.success);

export const webdavGet = (
    base: string,
    user: string,
    password: string,
    fileName: string,
): Promise<{
    ok: boolean;
    content?: string;
    status?: number;
    error?: string;
}> =>
    toPromise<WebdavGetFileResponse>((cb) =>
        bridgeWebdavGetFile({ base, user, password, fileName }, cb),
    );

// --- Rust 核心 ---
export const rustVersion = (): Promise<string> =>
    toPromise<RustVersionResponse>((cb) => bridgeRustVersion(cb)).then(
        (r) => r.version,
    );

// --- 爬虫引擎（Rust） ---
export const crawl = (
    op: string,
    sourceId: string,
    payload: string,
): Promise<string> =>
    toPromise<CrawlResponse>((cb) =>
        bridgeCrawl({ op, sourceId, payload }, cb),
    ).then((r) => r.json);
