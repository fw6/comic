/**
 * 统一数据服务层：真实图源链路（Webtoons / MangaDex）+ 原生桥持久化。
 * 不含任何 mock 数据：图源请求失败如实返回空（null/[]），由 UI 呈现空态；
 * 收藏/历史/标签/下载/设置/进度/图源开关通过原生 StorageModule 持久化。
 */

import {
    downloadImage,
    listDownloaded,
    scanLocalComics,
    storeGet,
    storeSet,
} from '../native/bridge.js';
import type { Chapter, Comic, DownloadItem, LibraryTab, Source } from './models.js';
import {
    adapterForComic,
    adapterForSource,
    adapters,
    type SourceAdapter,
} from './sources.js';

export { scanLocalComics } from '../native/bridge.js';
export type { SourceAdapter };

// --- 原生能力探测：非 Lynx 环境（web/jsdom 测试）不发起真实网络/持久化 ---
let nativeReady: boolean | null = null;
export function isNativeReady(): boolean {
    if (nativeReady !== null) return nativeReady;
    nativeReady = typeof NativeModules !== 'undefined';
    return nativeReady;
}
declare const NativeModules: unknown;

// --- 内存缓存 ---
const comicCache = new Map<string, Comic>();
const chapterCache = new Map<string, Chapter[]>();
const imageCache = new Map<string, string[]>();

/** 从缓存或网络获取漫画 */
export async function loadComic(id: string): Promise<Comic | null> {
    const cached = comicCache.get(id);
    // 若缓存标题是占位（仅来自列表页），需用详情页刷新完整信息
    const needDetail =
        cached === undefined || cached.title.startsWith('Webtoon ');
    if (!needDetail) return cached;
    const adapter = adapterForComic(id);
    if (isNativeReady() && adapter) {
        try {
            const { comic, chapters } = await adapter.fetchDetail(id);
            comicCache.set(id, comic);
            chapterCache.set(
                id,
                chapters.map((c) => ({ ...c })),
            );
            return comic;
        } catch {
            // 网络失败 → 如实返回 null
        }
    }
    return null;
}

/** 从缓存或网络获取章节 */
export async function loadChapters(id: string): Promise<Chapter[]> {
    const cached = chapterCache.get(id);
    if (cached) return cached;
    const comic = await loadComic(id);
    if (!comic) return [];
    const adapter = adapterForComic(id);
    if (isNativeReady() && adapter) {
        try {
            const { chapters } = await adapter.fetchDetail(id);
            const chs = chapters.map((c) => ({ ...c }));
            chapterCache.set(id, chs);
            return chs;
        } catch {
            // 网络失败 → 如实返回空
        }
    }
    return [];
}

/** 章节图片：真实 viewer 页解析 */
export async function loadChapterImages(
    id: string,
    chapterIndex: number,
): Promise<string[]> {
    const key = `${id}/${chapterIndex}`;
    const cachedImgs = imageCache.get(key);
    if (cachedImgs) return cachedImgs;
    const adapter = adapterForComic(id);
    if (isNativeReady() && adapter) {
        try {
            const imgs = await adapter.fetchChapterImages(id, chapterIndex);
            if (imgs.length > 0) {
                imageCache.set(key, imgs);
                return imgs;
            }
        } catch {
            // 网络失败 → 如实返回空
        }
    }
    return [];
}

/** 搜索：可限定图源（多源并发合并），否则在所有已启用图源上搜索 */
export async function searchComics(
    keyword: string,
    sourceIds?: string[],
): Promise<Comic[]> {
    if (!isNativeReady()) return [];
    const targets: SourceAdapter[] =
        sourceIds && sourceIds.length > 0
            ? (sourceIds
                  .map((id) => adapterForSource(id))
                  .filter((a): a is SourceAdapter => a !== undefined))
            : adapters;
    const results = await Promise.all(
        targets.map((a) => a.search(keyword).catch(() => [] as Comic[])),
    );
    const seen = new Set<string>();
    const merged: Comic[] = [];
    for (const list of results) {
        for (const c of list) {
            if (seen.has(c.id)) continue;
            seen.add(c.id);
            merged.push(c);
        }
    }
    return merged;
}

/** 分类浏览（指定图源） */
export async function categoryComics(
    label: string,
    sourceId: string,
): Promise<Comic[]> {
    if (!isNativeReady()) return [];
    const adapter = adapterForSource(sourceId);
    if (!adapter) return [];
    try {
        return await adapter.category(label);
    } catch {
        return [];
    }
}

export function sourceList(): Source[] {
    return adapters.map((a) => a.source);
}

export async function categoriesForSource(
    sourceId: string,
): Promise<string[]> {
    const adapter = adapterForSource(sourceId);
    if (!adapter) return [];
    try {
        return await adapter.categories();
    } catch {
        return [];
    }
}

// --- 真实下载 ---
export async function downloadChapter(
    comicId: string,
    chapterIndex: number,
    images: string[],
): Promise<boolean> {
    try {
        for (let i = 0; i < images.length; i++) {
            const ok = await downloadImage(images[i], comicId, chapterIndex, i);
            if (!ok) return false;
        }
        return true;
    } catch {
        return false;
    }
}

export async function listDownloadedComics(): Promise<
    Record<string, number[]>
> {
    if (!isNativeReady()) return {};
    try {
        const local = await scanLocalComics();
        const result: Record<string, number[]> = {};
        for (const item of local) {
            const comicId = item.comicId;
            const files = await listDownloaded(comicId);
            result[comicId] = Object.keys(files).map((k) => parseInt(k, 10));
        }
        return result;
    } catch {
        return {};
    }
}

// --- 本地漫画文件读取（供阅读器使用本地下载的图片） ---
export async function readLocalPages(
    comicId: string,
    chapterIndex: number,
): Promise<string[]> {
    if (!isNativeReady()) return [];
    try {
        const files = await listDownloaded(comicId);
        const list = files[String(chapterIndex)] ?? [];
        return list;
    } catch {
        return [];
    }
}

// --- 持久化 ---
const PERSIST_KEYS = {
    favorites: 'favorites',
    history: 'history',
    tags: 'tags',
    downloads: 'downloads',
    settings: 'settings',
    progress: 'progress',
    sources: 'sources',
    mode: 'mode',
} as const;

export async function persistState(key: string, value: unknown): Promise<void> {
    if (!isNativeReady()) return;
    try {
        await storeSet(key, JSON.stringify(value));
    } catch {
        // ignore persistence errors
    }
}

export async function loadPersisted<T>(key: string): Promise<T | null> {
    if (!isNativeReady()) return null;
    try {
        const raw = await storeGet(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export async function persistSettings(
    settings: Record<string, unknown>,
): Promise<void> {
    await persistState(PERSIST_KEYS.settings, settings);
}
export async function loadSettings(): Promise<Record<string, unknown> | null> {
    return loadPersisted<Record<string, unknown>>(PERSIST_KEYS.settings);
}
export async function persistFavorites(ids: string[]): Promise<void> {
    await persistState(PERSIST_KEYS.favorites, ids);
}
export async function loadFavorites(): Promise<string[] | null> {
    return loadPersisted<string[]>(PERSIST_KEYS.favorites);
}
export async function persistHistory(ids: string[]): Promise<void> {
    await persistState(PERSIST_KEYS.history, ids);
}
export async function loadHistory(): Promise<string[] | null> {
    return loadPersisted<string[]>(PERSIST_KEYS.history);
}
export async function persistTags(
    tags: Record<string, string[]>,
): Promise<void> {
    await persistState(PERSIST_KEYS.tags, tags);
}
export async function loadTags(): Promise<Record<string, string[]> | null> {
    return loadPersisted<Record<string, string[]>>(PERSIST_KEYS.tags);
}
export async function persistDownloads(
    d: Record<string, number[]>,
): Promise<void> {
    await persistState(PERSIST_KEYS.downloads, d);
}
export async function loadDownloads(): Promise<Record<
    string,
    number[]
> | null> {
    return loadPersisted<Record<string, number[]>>(PERSIST_KEYS.downloads);
}

export interface ReadingProgress {
    chapter: number;
    time: number;
}

/** 阅读进度：comicId -> 最后阅读的章节（Chapter.index，真实图源为话数）与时间 */
export async function persistProgress(
    m: Record<string, ReadingProgress>,
): Promise<void> {
    await persistState(PERSIST_KEYS.progress, m);
}
export async function loadProgress(): Promise<
    Record<string, ReadingProgress> | null
> {
    return loadPersisted<Record<string, ReadingProgress>>(
        PERSIST_KEYS.progress,
    );
}

/** 图源开关：sourceId -> enabled（Sources 页与 Search 页共享） */
export async function persistSources(
    map: Record<string, boolean>,
): Promise<void> {
    await persistState(PERSIST_KEYS.sources, map);
}
export async function loadSources(): Promise<Record<string, boolean> | null> {
    return loadPersisted<Record<string, boolean>>(PERSIST_KEYS.sources);
}

/** 墨色/纸面主题模式（跨页共享，覆盖启动默认值）。 */
export async function persistMode(mode: string): Promise<void> {
    await persistState(PERSIST_KEYS.mode, mode);
}
export async function loadMode(): Promise<string | null> {
    return loadPersisted<string>(PERSIST_KEYS.mode);
}

/** 仅更新内存中的漫画缓存（详情/信息弹窗展示最新续读位置）；进度持久化由 store 负责 */
export function updateComicProgress(
    comicId: string,
    chapterIndex: number,
    time: number,
): void {
    const cached = comicCache.get(comicId);
    if (cached) {
        cached.lastReadChapter = chapterIndex;
        cached.lastReadTime = time;
    }
}

export type { Chapter, Comic, DownloadItem, LibraryTab };
