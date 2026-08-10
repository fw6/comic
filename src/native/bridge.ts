/**
 * 原生桥封装：将 Lynx NativeModule 的 callback 风格 API 转换为 Promise。
 * 宿主侧模块：NetworkModule / StorageModule / DownloadModule / LocalModule / WebDavModule。
 *
 * 约定：原生 `callback.invoke(result)` 传入单个结果对象；
 * 失败时 `callback.invoke(false, message)`（首个参数为 false）。
 */
declare const NativeModules: Record<
    string,
    Record<string, (...args: unknown[]) => void>
>;

export function nativeCall<T>(
    module: string,
    method: string,
    ...params: unknown[]
): Promise<T> {
    const mod = NativeModules?.[module];
    if (!mod || typeof mod[method] !== 'function') {
        // 非原生环境（web/jsdom 测试）下调用失败，返回空结果。
        return Promise.reject(
            new Error(`NativeModule ${module}.${method} not available`),
        );
    }
    return new Promise<T>((resolve, reject) => {
        try {
            mod[method](...params, (...args: unknown[]) => {
                if (args.length > 0 && args[0] === false) {
                    reject(new Error(String(args[1] ?? 'native call failed')));
                } else {
                    resolve(args[0] as T);
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
    nativeCall('NetworkModule', 'getText', url, headers ?? {});

export const netGetBytes = (
    url: string,
): Promise<{ status: number; base64: string }> =>
    nativeCall('NetworkModule', 'getBytes', url);

export const isNetworkAvailable = (): Promise<boolean> =>
    nativeCall('NetworkModule', 'isNetworkAvailable');

// --- Storage ---
export const storeSet = (key: string, value: string): Promise<boolean> =>
    nativeCall('StorageModule', 'set', key, value);

export const storeGet = (key: string): Promise<string> =>
    nativeCall('StorageModule', 'get', key);

export const storeRemove = (key: string): Promise<boolean> =>
    nativeCall('StorageModule', 'remove', key);

// --- Download ---
export const downloadImage = (
    url: string,
    comicId: string,
    chapterIndex: number,
    pageIndex: number,
): Promise<boolean> =>
    nativeCall(
        'DownloadModule',
        'download',
        url,
        comicId,
        chapterIndex,
        pageIndex,
    );

export const listDownloaded = (
    comicId: string,
): Promise<Record<string, string[]>> =>
    nativeCall('DownloadModule', 'listDownloaded', comicId);

export const deleteComicDownload = (comicId: string): Promise<boolean> =>
    nativeCall('DownloadModule', 'deleteComic', comicId);

export const getDownloadDir = (): Promise<string> =>
    nativeCall('DownloadModule', 'getDownloadDir');

// --- Local ---
export const scanLocalComics = (): Promise<
    Array<{ comicId: string; chapterCount: number }>
> => nativeCall('LocalModule', 'scanLocalComics');

export const listLocalChapters = (
    comicId: string,
): Promise<Array<{ chapterIndex: number; pageCount: number; dir: string }>> =>
    nativeCall('LocalModule', 'listLocalChapters', comicId);

export const pickFolder = (): Promise<boolean> =>
    nativeCall('LocalModule', 'pickFolder');

// --- WebDav ---
export const webdavPut = (
    base: string,
    user: string,
    password: string,
    fileName: string,
    content: string,
): Promise<boolean> =>
    nativeCall(
        'WebDavModule',
        'putFile',
        base,
        user,
        password,
        fileName,
        content,
    );

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
}> => nativeCall('WebDavModule', 'getFile', base, user, password, fileName);
