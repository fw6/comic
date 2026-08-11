/**
 * MangaDex 图源解析器测试。
 * 使用从真实 MangaDex API 响应整理的结构化 fixture（JSON），
 * 验证搜索 / 分类（tags）/ 详情 / 章节 / 图片的解析。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../native/bridge.js', () => ({
    netGetText: vi.fn(),
}));

import { netGetText } from '../../native/bridge.js';
import {
    categoriesMangadex,
    categoryMangadex,
    fetchMangadexChapterImages,
    fetchMangadexDetail,
    searchMangadex,
} from '../mangadex.js';

const FIXTURES = join(
    process.cwd(),
    'src',
    'cimoc',
    'data',
    '__tests__',
    'fixtures',
);
const fixture = (name: string): string =>
    readFileSync(join(FIXTURES, name), 'utf8');

const mockNetGetText = vi.mocked(netGetText);
const MANGADEX_ID = '7e544761-7d3d-4fce-8137-719814d7d138';

/** 按 URL 分发 fixture 的假网络 */
function stubNetwork(): void {
    mockNetGetText.mockImplementation((url: string) => {
        if (url.includes('/manga/tag')) {
            return Promise.resolve({ status: 200, body: fixture('mangadex-tags.json') });
        }
        if (url.includes('/at-home/server/')) {
            return Promise.resolve({ status: 200, body: fixture('mangadex-at-home.json') });
        }
        if (url.includes(`/manga/${MANGADEX_ID}/feed`)) {
            return Promise.resolve({ status: 200, body: fixture('mangadex-feed.json') });
        }
        if (url.includes(`/manga/${MANGADEX_ID}`)) {
            return Promise.resolve({ status: 200, body: fixture('mangadex-detail.json') });
        }
        if (url.includes('/manga?')) {
            return Promise.resolve({ status: 200, body: fixture('mangadex-search.json') });
        }
        return Promise.reject(new Error(`unexpected url ${url}`));
    });
}

describe('searchMangadex', () => {
    it('解析搜索响应：id 前缀 / 标题 / 作者 / 封面 / 状态 / 标签', async () => {
        stubNetwork();
        const comics = await searchMangadex('eleceed');
        expect(comics).toHaveLength(2);
        const first = comics[0];
        expect(first.id).toBe(`mangadex-${MANGADEX_ID}`);
        expect(first.title).toBe('Eleceed');
        expect(first.author).toBe('Son Jae-Ho');
        expect(first.cover).toContain(
            'https://uploads.mangadex.org/covers/',
        );
        expect(first.cover).toContain('.256.jpg');
        expect(first.status).toBe('serial'); // ongoing
        expect(first.tags).toContain('Action');
        expect(first.intro).toContain('kind-hearted');
        // 已完结映射 finish
        expect(comics[1].status).toBe('finish');
    });

    it('非 200 直接抛错', async () => {
        mockNetGetText.mockResolvedValue({ status: 429, body: 'rate limited' });
        await expect(searchMangadex('eleceed')).rejects.toThrow(/429/);
    });
});

describe('MangaDex 分类（tags）', () => {
    it('categories 只返回 genre 分组标签', async () => {
        stubNetwork();
        const list = await categoriesMangadex();
        expect(list).toEqual(['Action', 'Romance', 'Fantasy']);
    });

    it('category 按标签名浏览', async () => {
        stubNetwork();
        const comics = await categoryMangadex('Action');
        expect(comics[0].title).toBe('Eleceed');
        expect(comics[0].id).toMatch(/^mangadex-/);
    });

    it('未知标签返回空', async () => {
        stubNetwork();
        expect(await categoryMangadex('不存在')).toEqual([]);
    });
});

describe('fetchMangadexDetail', () => {
    it('解析详情与章节（编号升序、去重、标题回退）', async () => {
        stubNetwork();
        const { comic, chapters } = await fetchMangadexDetail(MANGADEX_ID);
        expect(comic.title).toBe('Eleceed');
        expect(comic.author).toBe('Son Jae-Ho');
        expect(chapters.map((c) => c.index)).toEqual([1, 2, 3]);
        expect(chapters[0].title).toBe('Welcome');
        expect(chapters[1].title).toBe('第 2 话'); // title 为 null 时回退
        expect(comic.lastChapter).toBe('Rival'); // 最后一话
    });
});

describe('fetchMangadexChapterImages', () => {
    it('通过 at-home 服务器组装图片 URL', async () => {
        stubNetwork();
        const imgs = await fetchMangadexChapterImages(MANGADEX_ID, 1);
        expect(imgs).toHaveLength(2);
        expect(imgs[0]).toMatch(
            /^https:\/\/cmdxd98sb0x3yprd\.mangadex\.network\/data\/5ee6f31f.*\/f1-/,
        );
    });

    it('不存在的章节返回空', async () => {
        stubNetwork();
        expect(await fetchMangadexChapterImages(MANGADEX_ID, 999)).toEqual([]);
    });
});
