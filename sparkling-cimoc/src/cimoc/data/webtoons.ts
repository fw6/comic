/**
 * Webtoons 图源解析器（真实数据链路）。
 * 通过原生 NetworkModule 抓取 HTML 并解析，替代 mock 数据。
 * 覆盖 Cimoc 图源接口：搜索、分类、详情、章节、图片。
 */

import type { Chapter, Comic, Source } from '../data/models.js';
import { netGetText } from '../native/bridge.js';

const BASE = 'https://www.webtoons.com/en';
const UA_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

const GENRES: { key: string; label: string }[] = [
    { key: 'action', label: '动作' },
    { key: 'romance', label: '恋爱' },
    { key: 'comedy', label: '搞笑' },
    { key: 'drama', label: '剧情' },
    { key: 'fantasy', label: '奇幻' },
    { key: 'horror', label: '恐怖' },
    { key: 'sci-fi', label: '科幻' },
    { key: 'sports', label: '体育' },
];

export const WEBTOONS_SOURCE: Source = {
    id: 'webtoons',
    title: 'Webtoons',
    enabled: true,
    favoriteCount: 0,
};

/** 缓存 titleNo -> 系列详情页 URL（含 genre slug） */
const seriesUrlCache = new Map<string, string>();

/**
 * 系列 URL 需要跨会话可用：历史/收藏里的真实漫画在重启后靠它打开详情与图片。
 * 服务层在每次成功解析后调用 dump/hydrate 持久化（StorageModule）。
 */
export function dumpSeriesUrlCache(): Record<string, string> {
    return Object.fromEntries(seriesUrlCache.entries());
}

export function hydrateSeriesUrlCache(urls: Record<string, string>): void {
    for (const [id, url] of Object.entries(urls)) {
        if (!seriesUrlCache.has(id)) seriesUrlCache.set(id, url);
    }
}

export function webtoonsCategories(): string[] {
    return GENRES.map((g) => g.label);
}

/** 非 200 响应直接抛错，让服务层回退到 mock，而不是把错误页解析成垃圾数据 */
function ensureOk(res: { status: number }, label: string): void {
    if (res.status !== 200) {
        throw new Error(`Webtoons ${label} page HTTP ${res.status}`);
    }
}

/** HTML 实体解码 */
function decodeEntities(s: string): string {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

function extractSeriesId(url: string): string | null {
    const m = url.match(/[?&]title_no=(\d+)/);
    return m ? m[1] : null;
}

/** 从分类页/搜索页提取系列列表 */
export async function fetchSeriesList(
    kind: 'category' | 'search',
    keyword: string,
): Promise<Comic[]> {
    let url: string;
    if (kind === 'search') {
        url = `${BASE}/search?keyword=${encodeURIComponent(keyword)}`;
    } else {
        const genre = GENRES.find((g) => g.label === keyword) ?? GENRES[0];
        url = `${BASE}/genres/${genre.key}`;
    }
    const res = await netGetText(url, UA_HEADERS);
    ensureOk(res, `search "${keyword}"`);
    const html = res.body;
    const comics: Comic[] = [];
    // 系列卡片：<a href=".../list?title_no=NNN">，标题在 <p class="subj"> 或 title 属性
    const linkRe =
        /href="(https:\/\/www\.webtoons\.com\/en\/[^"]*\/list\?title_no=\d+)"/g;
    const seen = new Set<string>();
    for (const m of html.matchAll(linkRe)) {
        const id = extractSeriesId(m[1]);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        seriesUrlCache.set(id, m[1]);
        // 取该卡片（li 块）的标题与封面；标题可能位于链接后数百字符处
        const ctxStart = Math.max(0, html.lastIndexOf('<li', m.index - 400));
        const ctxEnd = html.indexOf('</li>', m.index);
        const ctx = html.slice(ctxStart, ctxEnd > 0 ? ctxEnd : m.index + 800);
        const titleM =
            ctx.match(/<strong class="title">\s*([^<]+)/) ||
            ctx.match(/<p class="subj">\s*([^<]+)/) ||
            ctx.match(/alt="([^"]+)"/) ||
            ctx.match(/title="([^"]+)"/);
        const coverM = ctx.match(
            /(?:data-src|src)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/,
        );
        comics.push({
            id: `webtoons-${id}`,
            source: 'webtoons',
            sourceTitle: 'Webtoons',
            title: titleM ? decodeEntities(titleM[1].trim()) : `Webtoon ${id}`,
            author: '',
            intro: '',
            cover: coverM ? coverM[1] : '',
            status: 'serial',
            updateTime: '',
            lastChapter: '',
            tags: [],
            lastReadChapter: 0,
            lastReadTime: 0,
        });
        if (comics.length >= 24) break;
    }
    return comics;
}

/** 搜索 */
export async function searchWebtoons(keyword: string): Promise<Comic[]> {
    return fetchSeriesList('search', keyword);
}

/** 分类浏览 */
export async function categoryWebtoons(label: string): Promise<Comic[]> {
    return fetchSeriesList('category', label);
}

/** 漫画详情 + 章节列表 */
export async function fetchComicDetail(
    titleNo: string,
): Promise<{ comic: Comic; chapters: Chapter[] }> {
    // 优先使用分类/搜索阶段缓存的系列 URL（含 genre slug）；否则构造兜底路径。
    // 注意：兜底路径（/any/）真实环境返回 500，只用于触发回退，不写入缓存——
    // 缓存只记录真实页面解析出的系列 URL，避免污染图片解析的 slug 提取。
    const seriesUrl =
        seriesUrlCache.get(titleNo) ?? `${BASE}/any/list?title_no=${titleNo}`;
    const res = await netGetText(seriesUrl, UA_HEADERS);
    ensureOk(res, `detail ${titleNo}`);
    const html = res.body;

    // 标题：优先 h1（跨页面变体最稳定），其次 <title> 标签
    const titleM =
        html.match(/<h1[^>]*class="subj"[^>]*>\s*([^<]+)/) ||
        html.match(/<h1[^>]*>([^<]+)/);
    const titleTag = html.match(/<title>\s*([^<|]+)/);
    const title = titleM
        ? decodeEntities(titleM[1].trim())
        : titleTag
          ? decodeEntities(titleTag[1].trim())
          : `Webtoon ${titleNo}`;
    // 封面：优先 og:image，其次 detail 区首张图片
    const ogImage = html.match(
        /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/,
    );
    const coverM = html.match(
        /<img[^>]*class="[^"]*thumb[^"]*"[^>]*src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/,
    );
    const cover =
        ogImage?.[1] ??
        coverM?.[1] ??
        html.match(
            /src="(https:\/\/webtoon-phinf\.pstatic\.net\/[^"]+\.(?:jpg|png|webp)[^"]*)"/,
        )?.[1] ??
        '';
    const authorM = html.match(/class="author"[^>]*>\s*([^<]+)/);
    const author = authorM
        ? decodeEntities(authorM[1].trim().split('/')[0].trim())
        : '';
    const descM = html.match(/<p[^>]*class="summary"[^>]*>\s*([\s\S]*?)<\/p>/);
    const intro = descM
        ? decodeEntities(descM[1].replace(/<[^>]+>/g, '').trim())
        : '';

    const comic: Comic = {
        id: `webtoons-${titleNo}`,
        source: 'webtoons',
        sourceTitle: 'Webtoons',
        title,
        author,
        intro,
        cover,
        status: 'serial',
        updateTime: '',
        lastChapter: '',
        tags: ['Webtoons'],
        lastReadChapter: 0,
        lastReadTime: 0,
    };

    // 章节列表：/viewer?title_no=NNN&episode_no=M
    const chapters: Chapter[] = [];
    const epRe =
        /href="(https:\/\/www\.webtoons\.com\/en\/[^"]*?\/viewer\?title_no=\d+&(?:amp;)?episode_no=(\d+))"/g;
    const seenEp = new Set<number>();
    for (const em of html.matchAll(epRe)) {
        const epNo = parseInt(em[2], 10);
        if (seenEp.has(epNo)) continue;
        seenEp.add(epNo);
        // 附近标题：真实结构为 <a ...><img ... alt="Episode N"><span class="subj"><span>Episode N</span>
        // 缩略图 alt 在 href 之后约 300 字符处，最稳定；subj 在 ~330 字符处。
        const after = html.slice(em.index, em.index + 600);
        const tM =
            after.match(/alt="([^"]+)"/) ||
            after.match(
                /<span[^>]*class="subj"[^>]*>\s*(?:<span[^>]*>\s*)?([^<]+)/,
            );
        chapters.push({
            index: epNo,
            title: tM ? decodeEntities(tM[1].trim()) : `第 ${epNo} 话`,
            pages: [], // 进入阅读器时按需加载
            downloaded: false,
            read: false,
        });
    }
    // 从大到小排序（最新在前）→ Cimoc 章节列表从旧到新
    chapters.sort((a, b) => b.index - a.index);
    comic.lastChapter = chapters.length > 0 ? chapters[0].title : '';
    return { comic, chapters };
}

/** 章节图片 URL 列表（viewer 页 _images 容器内的 data-url） */
export async function fetchChapterImages(
    titleNo: string,
    episodeNo: number,
): Promise<string[]> {
    // 必须使用真实 genre slug 路径（/any/ 路径不返回图片）
    // 从缓存的系列 URL 提取 slug 段，如 /en/action/eleceed/
    const seriesUrl = seriesUrlCache.get(titleNo);
    const slugMatch = seriesUrl?.match(
        /https:\/\/www\.webtoons\.com\/en\/([^/]+\/[^/]+)\/list\?/,
    );
    const path = slugMatch
        ? `${BASE}/${slugMatch[1]}/episode-${episodeNo}/viewer?title_no=${titleNo}&episode_no=${episodeNo}`
        : `${BASE}/any/episode-${episodeNo}/viewer?title_no=${titleNo}&episode_no=${episodeNo}`;
    const headers = {
        ...UA_HEADERS,
        Referer: seriesUrl ?? `${BASE}/any/list?title_no=${titleNo}`,
    };
    const res = await netGetText(path, headers);
    ensureOk(res, `viewer ${titleNo}/${episodeNo}`);
    const html = res.body;
    // viewer 页每个真实章节图片是 <img class="_images" data-url="..."> 元素
    const re = /class="_images"\s+data-url="([^"]+)"/g;
    const imgs: string[] = [];
    for (const m of html.matchAll(re)) {
        imgs.push(m[1]);
    }
    return imgs;
}

export function resolveTitleNo(comicId: string): string {
    return comicId.replace(/^webtoons-/, '');
}
