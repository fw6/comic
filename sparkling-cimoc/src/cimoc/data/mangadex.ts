/**
 * MangaDex 图源解析器（真实数据链路，基于官方公开 JSON API）。
 * 覆盖 Cimoc 图源接口：搜索、分类（tags）、详情、章节、图片。
 * 图片 CDN（*.mangadex.network）无热链保护，直接可加载。
 */

import type { Chapter, Comic, Source } from './models.js';
import { netGetText } from '../native/bridge.js';

const API = 'https://api.mangadex.org';
const COVER_CDN = 'https://uploads.mangadex.org/covers';
const UA = 'Cimoc/1.0';
/** 搜索/分类仅取适合大众的内容（排除成人分级） */
const CONTENT = 'contentRating[]=safe&contentRating[]=suggestive';

export const MANGA_SOURCE: Source = {
    id: 'mangadex',
    title: 'MangaDex',
    enabled: true,
    favoriteCount: 0,
};

interface MangaNode {
    id: string;
    attributes: {
        title: Record<string, string>;
        description?: Record<string, string>;
        status?: string; // ongoing | completed | cancelled | ...
        tags?: {
            id: string;
            attributes: { name: Record<string, string>; group?: string };
        }[];
    };
    relationships?: {
        type: string;
        id: string;
        attributes?: { name?: string; fileName?: string };
    }[];
}

interface ChapterNode {
    id: string;
    attributes: { chapter?: string | null; title?: string | null };
}

function pickLocalized(
    map: Record<string, string> | undefined,
    fallback = '',
): string {
    if (!map) return fallback;
    return (
        map.en ??
        map['zh'] ??
        map['ja'] ?? map['ko'] ?? Object.values(map)[0] ?? fallback
    );
}

function stripHtml(s: string): string {
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function rel(node: MangaNode, type: string) {
    return node.relationships?.find((r) => r.type === type);
}

function toComic(node: MangaNode): Comic {
    const cover = rel(node, 'cover_art')?.attributes?.fileName;
    return {
        id: `mangadex-${node.id}`,
        source: 'mangadex',
        sourceTitle: 'MangaDex',
        title: pickLocalized(node.attributes.title, 'Manga'),
        author: rel(node, 'author')?.attributes?.name ?? '',
        intro: stripHtml(pickLocalized(node.attributes.description)),
        cover: cover ? `${COVER_CDN}/${node.id}/${cover}.256.jpg` : '',
        status: node.attributes.status === 'completed' ? 'finish' : 'serial',
        updateTime: '',
        lastChapter: '',
        tags: (node.attributes.tags ?? [])
            .map((t) => pickLocalized(t.attributes.name))
            .filter(Boolean),
        lastReadChapter: 0,
        lastReadTime: 0,
    };
}

async function getJson(url: string): Promise<unknown> {
    const res = await netGetText(url, {
        'User-Agent': UA,
        Accept: 'application/json',
    });
    if (res.status !== 200) throw new Error(`MangaDex HTTP ${res.status}`);
    return JSON.parse(res.body) as unknown;
}

/** 搜索 */
export async function searchMangadex(keyword: string): Promise<Comic[]> {
    const url = `${API}/manga?title=${encodeURIComponent(keyword)}&limit=24&includes[]=cover_art&includes[]=author&${CONTENT}&order[relevance]=desc`;
    const json = (await getJson(url)) as { data?: MangaNode[] };
    return (json.data ?? []).map(toComic);
}

// --- 分类：MangaDex 的 genre 标签 ---
let tagsCache: { id: string; label: string }[] | null = null;

async function loadTags(): Promise<void> {
    if (tagsCache) return;
    const json = (await getJson(`${API}/manga/tag`)) as {
        data?: {
            id: string;
            attributes: { name: Record<string, string>; group?: string };
        }[];
    };
    tagsCache = (json.data ?? [])
        .filter((t) => t.attributes.group === 'genre')
        .map((t) => ({ id: t.id, label: pickLocalized(t.attributes.name) }))
        .filter((t) => t.label);
}

export async function categoriesMangadex(): Promise<string[]> {
    try {
        await loadTags();
    } catch {
        return [];
    }
    return (tagsCache ?? []).map((t) => t.label);
}

/** 按 genre 标签浏览 */
export async function categoryMangadex(label: string): Promise<Comic[]> {
    await loadTags();
    const tag = tagsCache?.find((t) => t.label === label);
    if (!tag) return [];
    const url = `${API}/manga?includedTags[]=${tag.id}&limit=24&includes[]=cover_art&includes[]=author&${CONTENT}`;
    const json = (await getJson(url)) as { data?: MangaNode[] };
    return (json.data ?? []).map(toComic);
}

// --- 详情 + 章节列表 ---
async function fetchFeed(mangaId: string): Promise<ChapterNode[]> {
    const url = `${API}/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=500&includes[]=scanlation_group`;
    const json = (await getJson(url)) as { data?: ChapterNode[] };
    return json.data ?? [];
}

function toChapters(feed: ChapterNode[]): Chapter[] {
    const seen = new Set<number>();
    const chapters: Chapter[] = [];
    for (const ch of feed) {
        const num = ch.attributes.chapter
            ? Number.parseFloat(ch.attributes.chapter)
            : NaN;
        if (!Number.isFinite(num) || seen.has(num)) continue;
        seen.add(num);
        chapters.push({
            index: num,
            title: ch.attributes.title ?? `第 ${num} 话`,
            pages: [],
            downloaded: false,
            read: false,
        });
    }
    return chapters;
}

export async function fetchMangadexDetail(
    mangaId: string,
): Promise<{ comic: Comic; chapters: Chapter[] }> {
    const [mangaJson, feed] = await Promise.all([
        getJson(
            `${API}/manga/${mangaId}?includes[]=author&includes[]=artist&includes[]=cover_art`,
        ),
        fetchFeed(mangaId).catch(() => [] as ChapterNode[]),
    ]);
    const node = (mangaJson as { data?: MangaNode }).data;
    if (!node) throw new Error('MangaDex manga not found');
    const comic = toComic(node);
    const chapters = toChapters(feed);
    comic.lastChapter =
        chapters.length > 0 ? chapters[chapters.length - 1].title : '';
    return { comic, chapters };
}

// --- 章节图片（at-home 服务器） ---
let chapterIdCache = new Map<string, { index: number; id: string }[]>();

export async function fetchMangadexChapterImages(
    mangaId: string,
    chapterIndex: number,
): Promise<string[]> {
    let list = chapterIdCache.get(mangaId);
    if (!list) {
        const feed = await fetchFeed(mangaId);
        list = [];
        const seen = new Set<number>();
        for (const ch of feed) {
            const num = ch.attributes.chapter
                ? Number.parseFloat(ch.attributes.chapter)
                : NaN;
            if (!Number.isFinite(num) || seen.has(num)) continue;
            seen.add(num);
            list.push({ index: num, id: ch.id });
        }
        chapterIdCache.set(mangaId, list);
    }
    const chapter = list.find((c) => c.index === chapterIndex);
    if (!chapter) return [];
    const json = (await getJson(
        `${API}/at-home/server/${chapter.id}`,
    )) as {
        baseUrl?: string;
        chapter?: { hash?: string; data?: string[] };
    };
    const { baseUrl, chapter: ch } = json;
    if (!baseUrl || !ch?.hash || !ch.data) return [];
    return ch.data.map((f) => `${baseUrl}/data/${ch.hash}/${f}`);
}
