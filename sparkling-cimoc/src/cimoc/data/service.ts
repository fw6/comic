/**
 * 统一数据服务层：真实数据链路（Webtoons 图源 + 原生桥持久化）。
 * - 浏览/搜索/详情/章节/图片：来自真实 Webtoons 数据。
 * - 收藏/历史/标签/下载/设置：通过原生 StorageModule 持久化。
 * - 当原生桥不可用（web/jsdom 测试环境）时回退到 mock，保证 UI 可开发验证。
 */

import {
    downloadImage,
    listDownloaded,
    scanLocalComics,
    storeGet,
    storeSet,
} from '../native/bridge.js';
import {
    getChapters as getMockChapters,
    COMICS as MOCK_COMICS,
    SOURCES as MOCK_SOURCES,
} from './mock.js';
import type {
    Chapter,
    Comic,
    DownloadItem,
    LibraryTab,
    Source,
} from './models.js';
import {
    categoryWebtoons,
    fetchChapterImages,
    fetchComicDetail,
    searchWebtoons,
    WEBTOONS_SOURCE,
    webtoonsCategories,
} from './webtoons.js';

export { scanLocalComics } from '../native/bridge.js';

// --- 原生能力探测：在非 Lynx 环境（测试）中回退到 mock ---
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

const ID_PREFIX = 'webtoons-';

function isWebtoonsId(id: string): boolean {
    return id.startsWith(ID_PREFIX);
}

/** 从缓存或网络获取漫画 */
export async function loadComic(id: string): Promise<Comic | null> {
    const cached = comicCache.get(id);
    // 若缓存标题是占位（Webtoon xxx），说明仅来自列表页，需用详情页刷新完整信息
    const needDetail =
        cached === undefined || cached.title.startsWith('Webtoon ');
    if (!needDetail) return cached;
    if (isNativeReady() && isWebtoonsId(id)) {
        try {
            const titleNo = id.slice(ID_PREFIX.length);
            const { comic, chapters } = await fetchComicDetail(titleNo);
            comicCache.set(id, comic);
            chapterCache.set(
                id,
                chapters.map((c) => ({ ...c })),
            );
            return comic;
        } catch {
            // 网络失败 → 回退
        }
    }
    const mock = MOCK_COMICS.find((c) => c.id === id);
    if (mock) {
        comicCache.set(id, mock);
        chapterCache.set(id, getMockChapters(mock));
        return mock;
    }
    return null;
}

/** 从缓存或网络获取章节 */
export async function loadChapters(id: string): Promise<Chapter[]> {
    const cached = chapterCache.get(id);
    if (cached) return cached;
    const comic = await loadComic(id);
    if (!comic) return [];
    if (isNativeReady() && isWebtoonsId(id)) {
        try {
            const titleNo = id.slice(ID_PREFIX.length);
            const { chapters } = await fetchComicDetail(titleNo);
            const chs = chapters.map((c) => ({ ...c }));
            chapterCache.set(id, chs);
            return chs;
        } catch {
            // fall through to mock
        }
    }
    const mock = MOCK_COMICS.find((c) => c.id === id);
    if (mock) {
        const chs = getMockChapters(mock);
        chapterCache.set(id, chs);
        return chs;
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
    if (isNativeReady() && isWebtoonsId(id)) {
        try {
            const titleNo = id.slice(ID_PREFIX.length);
            const imgs = await fetchChapterImages(titleNo, chapterIndex);
            if (imgs.length > 0) {
                imageCache.set(key, imgs);
                return imgs;
            }
        } catch {
            // fall through
        }
    }
    // mock：生成占位色块（图片加载失败时兜底）
    const chapters = await loadChapters(id);
    const ch = chapters.find((c) => c.index === chapterIndex);
    const n = ch?.pages.length ?? 12;
    return Array.from({ length: n }, (_, i) => `mock-color-${i}`);
}

/** 搜索（真实） */
export async function searchComics(keyword: string): Promise<Comic[]> {
    if (isNativeReady()) {
        try {
            const results = await searchWebtoons(keyword);
            if (results.length > 0) {
                for (const r of results) comicCache.set(r.id, r);
                return results;
            }
        } catch {
            // fall through
        }
    }
    return MOCK_COMICS.filter(
        (c) =>
            c.title.includes(keyword) ||
            c.author.includes(keyword) ||
            c.tags.some((t) => t.includes(keyword)),
    ).slice(0, 30);
}

/** 分类浏览（真实） */
export async function categoryComics(label: string): Promise<Comic[]> {
    if (isNativeReady()) {
        try {
            const results = await categoryWebtoons(label);
            if (results.length > 0) {
                for (const r of results) comicCache.set(r.id, r);
                return results;
            }
        } catch {
            // fall through
        }
    }
    return MOCK_COMICS.filter((c) => c.tags.includes(label)).slice(0, 30);
}

export function sourceList(): Source[] {
    if (isNativeReady()) {
        return [WEBTOONS_SOURCE, ...MOCK_SOURCES.slice(1)];
    }
    return MOCK_SOURCES;
}

export function categoriesForSource(sourceId: string): string[] {
    if (sourceId === 'webtoons') return webtoonsCategories();
    return MOCK_SOURCES.find((s) => s.id === sourceId)
        ? ['热门', '最新', '热血', '恋爱']
        : [];
}

// --- 真实下载 ---
export async function downloadChapter(
    comicId: string,
    chapterIndex: number,
    images: string[],
): Promise<boolean> {
    if (!isNativeReady()) return true; // 非原生环境直接标记成功
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

export type { Chapter, Comic, DownloadItem, LibraryTab };
