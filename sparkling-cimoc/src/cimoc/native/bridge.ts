/**
 * 原生桥封装：将 Sparkling 方法包（sparkling-cimoc-bridge）的 callback 风格 API 转换为 Promise。
 * 方法包基于 pipe 协议：回调收到 {code, msg, data}，code === 1 表示成功，data 为结果模型字段。
 * 导出签名与旧 NativeModule 桥保持一致，service.ts / screens 无需改动。
 */
import {
    deleteComicDownload as bridgeDeleteComicDownload,
    downloadChapter as bridgeDownloadChapter,
    getBytes as bridgeGetBytes,
    getDownloadDir as bridgeGetDownloadDir,
    getText as bridgeGetText,
    getValue as bridgeGetValue,
    isNetworkAvailable as bridgeIsNetworkAvailable,
    listDownloadedChapters as bridgeListDownloadedChapters,
    listKeys as bridgeListKeys,
    listLocalChapters as bridgeListLocalChapters,
    pickFolder as bridgePickFolder,
    removeValue as bridgeRemoveValue,
    scanLocalComics as bridgeScanLocalComics,
    setValue as bridgeSetValue,
    webdavGetFile as bridgeWebdavGetFile,
    webdavPutFile as bridgeWebdavPutFile,
    type DeleteComicDownloadResponse,
    type DownloadChapterResponse,
    type GetBytesResponse,
    type GetDownloadDirResponse,
    type GetTextResponse,
    type GetValueResponse,
    type IsNetworkAvailableResponse,
    type ListDownloadedChaptersResponse,
    type ListKeysResponse,
    type ListLocalChaptersResponse,
    type PickFolderResponse,
    type PipeResult,
    type RemoveValueResponse,
    type ScanLocalComicsResponse,
    type SetValueResponse,
    type WebdavGetFileResponse,
    type WebdavPutFileResponse,
} from 'sparkling-cimoc-bridge';

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

// --- Network ---
export const netGetText = (
    url: string,
    headers?: Record<string, string>,
): Promise<{ status: number; body: string }> =>
    toPromise<GetTextResponse>((cb) =>
        bridgeGetText(
            { url, headers: headers ? JSON.stringify(headers) : undefined },
            cb,
        ),
    );

export const netGetBytes = (
    url: string,
): Promise<{ status: number; base64: string }> =>
    toPromise<GetBytesResponse>((cb) => bridgeGetBytes({ url }, cb));

export const isNetworkAvailable = (): Promise<boolean> =>
    toPromise<IsNetworkAvailableResponse>((cb) =>
        bridgeIsNetworkAvailable(cb),
    ).then((r) => r.available);

// --- Storage ---
export const storeSet = (key: string, value: string): Promise<boolean> =>
    toPromise<SetValueResponse>((cb) => bridgeSetValue({ key, value }, cb)).then(
        (r) => r.success,
    );

export const storeGet = (key: string): Promise<string> =>
    toPromise<GetValueResponse>((cb) => bridgeGetValue({ key }, cb)).then(
        (r) => r.value,
    );

export const storeRemove = (key: string): Promise<boolean> =>
    toPromise<RemoveValueResponse>((cb) =>
        bridgeRemoveValue({ key }, cb),
    ).then((r) => r.success);

export const listKeys = (): Promise<string[]> =>
    toPromise<ListKeysResponse>((cb) => bridgeListKeys(cb)).then(
        (r) => r.keys,
    );

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

export const deleteComicDownload = (comicId: string): Promise<boolean> =>
    toPromise<DeleteComicDownloadResponse>((cb) =>
        bridgeDeleteComicDownload({ comicId }, cb),
    ).then((r) => r.success);

export const getDownloadDir = (): Promise<string> =>
    toPromise<GetDownloadDirResponse>((cb) => bridgeGetDownloadDir(cb)).then(
        (r) => r.dir,
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

export const listLocalChapters = (
    comicId: string,
): Promise<Array<{ chapterIndex: number; pageCount: number; dir: string }>> =>
    toPromise<ListLocalChaptersResponse>((cb) =>
        bridgeListLocalChapters({ comicId }, cb),
    ).then(
        (r) =>
            JSON.parse(r.chaptersJson) as Array<{
                chapterIndex: number;
                pageCount: number;
                dir: string;
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
