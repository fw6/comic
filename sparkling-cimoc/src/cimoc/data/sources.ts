/**
 * 真实图源注册表：将各图源解析模块（webtoons/mangadex）适配为统一的 SourceAdapter，
 * 供 service 层按图源分派（前缀路由 / 搜索 / 分类 / 详情 / 图片）。
 */

import type { Chapter, Comic, Source } from './models.js';
import { storeGet, storeSet } from '../native/bridge.js';
import {
    categoryWebtoons,
    dumpSeriesUrlCache,
    fetchChapterImages as fetchWebtoonsImages,
    fetchComicDetail,
    hydrateSeriesUrlCache,
    searchWebtoons,
    WEBTOONS_SOURCE,
    webtoonsCategories,
} from './webtoons.js';
import {
    categoriesMangadex,
    categoryMangadex,
    fetchMangadexChapterImages,
    fetchMangadexDetail,
    MANGA_SOURCE,
    searchMangadex,
} from './mangadex.js';

export interface SourceAdapter {
    source: Source;
    /** 该源的漫画 id 前缀判定（如 webtoons- / mangadex-） */
    isComicId(id: string): boolean;
    /** 分类列表（可能需网络，如 MangaDex tags） */
    categories(): Promise<string[]>;
    search(keyword: string): Promise<Comic[]>;
    /** 按分类 label 浏览（label 与 categories() 返回一致） */
    category(label: string): Promise<Comic[]>;
    fetchDetail(comicId: string): Promise<{ comic: Comic; chapters: Chapter[] }>;
    fetchChapterImages(comicId: string, chapterIndex: number): Promise<string[]>;
}

const WEBTOONS_PREFIX = 'webtoons-';
const MANGA_PREFIX = 'mangadex-';

// --- Webtoons：系列 URL（含 genre slug）需要跨会话恢复，否则重启后打不开历史/收藏 ---
let webtoonsHydrated = false;
async function ensureWebtoonsHydrated(): Promise<void> {
    if (webtoonsHydrated) return;
    webtoonsHydrated = true;
    try {
        const raw = await storeGet('series-urls');
        if (raw) hydrateSeriesUrlCache(JSON.parse(raw) as Record<string, string>);
    } catch {
        // 恢复失败不阻塞真实数据请求
    }
}
async function persistWebtoonsUrls(): Promise<void> {
    try {
        await storeSet('series-urls', JSON.stringify(dumpSeriesUrlCache()));
    } catch {
        // 持久化失败忽略
    }
}

const webtoonsAdapter: SourceAdapter = {
    source: WEBTOONS_SOURCE,
    isComicId: (id) => id.startsWith(WEBTOONS_PREFIX),
    categories: async () => webtoonsCategories(),
    search: async (keyword) => {
        await ensureWebtoonsHydrated();
        const results = await searchWebtoons(keyword);
        await persistWebtoonsUrls();
        return results;
    },
    category: async (label) => {
        await ensureWebtoonsHydrated();
        const results = await categoryWebtoons(label);
        await persistWebtoonsUrls();
        return results;
    },
    fetchDetail: async (comicId) => {
        await ensureWebtoonsHydrated();
        const titleNo = comicId.slice(WEBTOONS_PREFIX.length);
        const detail = await fetchComicDetail(titleNo);
        await persistWebtoonsUrls();
        return detail;
    },
    fetchChapterImages: (comicId, chapterIndex) => {
        const titleNo = comicId.slice(WEBTOONS_PREFIX.length);
        return fetchWebtoonsImages(titleNo, chapterIndex);
    },
};

const mangadexAdapter: SourceAdapter = {
    source: MANGA_SOURCE,
    isComicId: (id) => id.startsWith(MANGA_PREFIX),
    categories: categoriesMangadex,
    search: searchMangadex,
    category: categoryMangadex,
    fetchDetail: (comicId) =>
        fetchMangadexDetail(comicId.slice(MANGA_PREFIX.length)),
    fetchChapterImages: (comicId, chapterIndex) =>
        fetchMangadexChapterImages(comicId.slice(MANGA_PREFIX.length), chapterIndex),
};

export const adapters: SourceAdapter[] = [webtoonsAdapter, mangadexAdapter];

export function adapterForComic(comicId: string): SourceAdapter | undefined {
    return adapters.find((a) => a.isComicId(comicId));
}

export function adapterForSource(sourceId: string): SourceAdapter | undefined {
    return adapters.find((a) => a.source.id === sourceId);
}
