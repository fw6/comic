import type { Chapter, Comic, DownloadItem, Source } from './models.js';

// Deterministic pseudo-random palette for comic covers (Cimoc shows grid covers).
const PALETTE = [
    '#E53935',
    '#D81B60',
    '#8E24AA',
    '#5E35B1',
    '#3949AB',
    '#1E88E5',
    '#00897B',
    '#43A047',
    '#F4511E',
    '#6D4C41',
    '#546E7A',
    '#C0CA33',
];

function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h;
}

export function coverColor(id: string): string {
    return PALETTE[hashString(id) % PALETTE.length];
}

export const SOURCES: Source[] = [
    { id: 'dmzj', title: '动漫之家', enabled: true, favoriteCount: 328 },
    { id: 'dm5', title: '动漫屋', enabled: true, favoriteCount: 512 },
    { id: 'buka', title: '布卡漫画', enabled: true, favoriteCount: 89 },
    { id: 'tencent', title: '腾讯动漫', enabled: true, favoriteCount: 1043 },
    { id: 'u17', title: '有妖气', enabled: false, favoriteCount: 231 },
    { id: 'kuaikan', title: '快看漫画', enabled: false, favoriteCount: 76 },
    {
        id: 'mangakakalot',
        title: 'Mangakakalot',
        enabled: true,
        favoriteCount: 45,
    },
    { id: 'webtoon', title: 'Webtoon', enabled: false, favoriteCount: 12 },
    { id: 'mangabz', title: '漫画堆', enabled: true, favoriteCount: 58 },
    { id: 'mh160', title: '漫画人', enabled: true, favoriteCount: 34 },
    { id: 'ehentai', title: 'EHentai', enabled: false, favoriteCount: 0 },
    { id: 'nhentai', title: 'NHeitai', enabled: false, favoriteCount: 0 },
];

const TITLES = [
    '海贼王',
    '火影忍者',
    '进击的巨人',
    '鬼灭之刃',
    '咒术回战',
    '一拳超人',
    '东京喰种',
    '死亡笔记',
    '钢之炼金术师',
    '银魂',
    '黑子的篮球',
    '灌篮高手',
    '名侦探柯南',
    '龙珠',
    '全职猎人',
    '排球少年',
    '食戟之灵',
    '我的英雄学院',
];

const AUTHORS = [
    '尾田荣一郎',
    '岸本齐史',
    '谏山创',
    '吾峠呼世晴',
    '芥见下下',
    'ONE',
    '石田スイ',
    '大场鸫',
    '荒川弘',
    '空知英秋',
    '藤卷忠俊',
    '井上雄彦',
];

const INTRO =
    '讲述了少年在这个充满热血与梦想的世界里不断成长、与伙伴并肩作战的传奇故事。';

function makeComic(i: number): Comic {
    const title = TITLES[i % TITLES.length];
    const id = `comic-${i}`;
    const source = SOURCES[i % SOURCES.length];
    const chapterCount = 20 + (i % 80);
    return {
        id,
        source: source.id,
        sourceTitle: source.title,
        title,
        author: AUTHORS[i % AUTHORS.length],
        intro: `${title}：${INTRO}`,
        cover: coverColor(id),
        status: i % 3 === 0 ? 'serial' : 'finish',
        updateTime: `2026-0${(i % 9) + 1}-${10 + (i % 18)}`,
        lastChapter: `第${chapterCount}话`,
        tags:
            i % 4 === 0
                ? ['热血', '少年']
                : i % 4 === 1
                  ? ['治愈']
                  : ['悬疑', '冒险'],
        lastReadChapter: i % chapterCount,
        lastReadTime: Date.now() - i * 3600_000,
    };
}

function makeChapters(comic: Comic): Chapter[] {
    const count = 20 + (hashString(comic.id) % 80);
    const arr: Chapter[] = [];
    for (let c = 0; c < count; c++) {
        const pageCount = 12 + (hashString(`${comic.id}-${c}`) % 18);
        arr.push({
            index: c,
            title: `第${c + 1}话`,
            pages: Array.from({ length: pageCount }, (_, p) =>
                coverColor(`${comic.id}-${c}-${p}`),
            ),
            downloaded: c < 3,
            read: c <= comic.lastReadChapter,
        });
    }
    return arr;
}

const comics: Comic[] =
    TITLES.length > 0 ? Array.from({ length: 60 }, (_, i) => makeComic(i)) : [];

const chapterCache = new Map<string, Chapter[]>();
export function getChapters(comic: Comic): Chapter[] {
    if (!chapterCache.has(comic.id)) {
        chapterCache.set(comic.id, makeChapters(comic));
    }
    const cached = chapterCache.get(comic.id);
    return cached ?? [];
}

export const COMICS: Comic[] = comics;
export function getComic(id: string): Comic | undefined {
    return comics.find((c) => c.id === id);
}

export function getComicsByIds(ids: string[]): Comic[] {
    return ids.map(getComic).filter((c): c is Comic => Boolean(c));
}

// History: most recent first.
export const HISTORY_IDS: string[] = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (i) => `comic-${i}`,
);
// Favorites: a different subset.
export const FAVORITE_IDS: string[] = [2, 5, 8, 11, 14, 17, 20, 23, 26].map(
    (i) => `comic-${i}`,
);
// Downloaded comics.
export const DOWNLOAD_IDS: string[] = [1, 4, 9].map((i) => `comic-${i}`);
// Local comics (imported files).
export const LOCAL_IDS: string[] = [3, 6, 12].map((i) => `comic-${i}`);

export const DOWNLOADS: DownloadItem[] = [
    {
        comicId: 'comic-1',
        chapterIndexes: [0, 1, 2],
        paused: false,
        progress: 100,
    },
    { comicId: 'comic-4', chapterIndexes: [0, 1], paused: true, progress: 55 },
    { comicId: 'comic-9', chapterIndexes: [0], paused: false, progress: 20 },
];

export const SEARCH_SUGGESTIONS = [
    '海贼王',
    '火影',
    '巨人',
    '鬼灭',
    '咒术',
    '一拳',
];
