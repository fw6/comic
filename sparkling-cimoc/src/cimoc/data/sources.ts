/**
 * 真实图源注册表：将各图源适配为统一的 SourceAdapter。
 * 抓取 + 解析已下沉到 Rust 核心（cimoc-core），本层只做「cimoc.crawl 调用 + JSON 解析」，
 * 把结果映射回 Comic/Chapter 领域模型，供 service 层按图源分派。
 */

import { crawl, storeGet, storeSet } from '../native/bridge.js';
import type { Chapter, Comic, Source } from './models.js';

export interface SourceAdapter {
    source: Source;
    /** 该源的漫画 id 前缀判定（如 webtoons- / mangadex-） */
    isComicId(id: string): boolean;
    /** 分类列表（可能需网络，如 MangaDex tags） */
    categories(): Promise<string[]>;
    search(keyword: string): Promise<Comic[]>;
    /** 按分类 label 浏览（label 与 categories() 返回一致） */
    category(label: string): Promise<Comic[]>;
    fetchDetail(
        comicId: string,
    ): Promise<{ comic: Comic; chapters: Chapter[] }>;
    fetchChapterImages(
        comicId: string,
        chapterIndex: number,
    ): Promise<string[]>;
}

export const WEBTOONS_SOURCE: Source = {
    id: 'webtoons',
    title: 'Webtoons',
    enabled: true,
    favoriteCount: 0,
};

export const MANGA_SOURCE: Source = {
    id: 'mangadex',
    title: 'MangaDex',
    enabled: true,
    favoriteCount: 0,
};

const WEBTOONS_PREFIX = 'webtoons-';
const MANGA_PREFIX = 'mangadex-';

/** 调 Rust crawl，把 payload 编码为 JSON 后解析返回的 JSON 字符串。 */
function crawlJson<T>(
    sourceId: string,
    op: string,
    payload: unknown,
): Promise<T> {
    return crawl(op, sourceId, JSON.stringify(payload)).then(
        (json) => JSON.parse(json) as T,
    );
}

// --- Webtoons：系列 URL（含 genre slug）需要跨会话恢复，否则重启后打不开历史/收藏 ---
let webtoonsHydrated = false;
async function ensureWebtoonsHydrated(): Promise<void> {
    if (webtoonsHydrated) return;
    webtoonsHydrated = true;
    try {
        const raw = await storeGet('series-urls');
        if (raw) await crawl('cache_hydrate', 'webtoons', raw);
    } catch {
        // 恢复失败不阻塞真实数据请求
    }
}
async function persistWebtoonsUrls(): Promise<void> {
    try {
        const json = await crawl('cache_dump', 'webtoons', '{}');
        await storeSet('series-urls', json);
    } catch {
        // 持久化失败忽略
    }
}

const webtoonsAdapter: SourceAdapter = {
    source: WEBTOONS_SOURCE,
    isComicId: (id) => id.startsWith(WEBTOONS_PREFIX),
    categories: () => crawlJson<string[]>('webtoons', 'categories', {}),
    search: async (keyword) => {
        await ensureWebtoonsHydrated();
        const results = await crawlJson<Comic[]>('webtoons', 'search', {
            keyword,
        });
        await persistWebtoonsUrls();
        return results;
    },
    category: async (label) => {
        await ensureWebtoonsHydrated();
        const results = await crawlJson<Comic[]>('webtoons', 'category', {
            label,
        });
        await persistWebtoonsUrls();
        return results;
    },
    fetchDetail: async (comicId) => {
        await ensureWebtoonsHydrated();
        const detail = await crawlJson<{ comic: Comic; chapters: Chapter[] }>(
            'webtoons',
            'detail',
            { comicId },
        );
        await persistWebtoonsUrls();
        return detail;
    },
    fetchChapterImages: (comicId, chapterIndex) =>
        crawlJson<string[]>('webtoons', 'images', { comicId, chapterIndex }),
};

const mangadexAdapter: SourceAdapter = {
    source: MANGA_SOURCE,
    isComicId: (id) => id.startsWith(MANGA_PREFIX),
    categories: () => crawlJson<string[]>('mangadex', 'categories', {}),
    search: (keyword) => crawlJson<Comic[]>('mangadex', 'search', { keyword }),
    category: (label) => crawlJson<Comic[]>('mangadex', 'category', { label }),
    fetchDetail: (comicId) =>
        crawlJson<{ comic: Comic; chapters: Chapter[] }>('mangadex', 'detail', {
            comicId,
        }),
    fetchChapterImages: (comicId, chapterIndex) =>
        crawlJson<string[]>('mangadex', 'images', { comicId, chapterIndex }),
};

export const adapters: SourceAdapter[] = [webtoonsAdapter, mangadexAdapter];

export function adapterForComic(comicId: string): SourceAdapter | undefined {
    return adapters.find((a) => a.isComicId(comicId));
}

export function adapterForSource(sourceId: string): SourceAdapter | undefined {
    return adapters.find((a) => a.source.id === sourceId);
}
