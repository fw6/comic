/**
 * Webtoons 图源解析器测试。
 * 使用从真实 Webtoons 页面抓取的 HTML 片段作为 fixture，
 * 验证搜索 / 详情 / 章节 / 图片的解析结构与真实站点一致。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../native/bridge.js', () => ({
    netGetText: vi.fn(),
}));

import { netGetText } from '../../native/bridge.js';
import {
    dumpSeriesUrlCache,
    fetchChapterImages,
    fetchComicDetail,
    hydrateSeriesUrlCache,
    searchWebtoons,
} from '../webtoons.js';

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

describe('searchWebtoons', () => {
    it('解析真实搜索页卡片：标题 / 封面 / 系列 URL', async () => {
        mockNetGetText.mockResolvedValue({
            status: 200,
            body: fixture('search-card.html'),
        });
        const comics = await searchWebtoons('eleceed');
        expect(comics).toHaveLength(1);
        expect(comics[0].id).toBe('webtoons-1571');
        expect(comics[0].title).toBe('Eleceed');
        expect(comics[0].cover).toContain('webtoon-phinf.pstatic.net');
        // 解析到的系列 URL 进入缓存，供详情/图片使用
        expect(dumpSeriesUrlCache()['1571']).toBe(
            'https://www.webtoons.com/en/action/eleceed/list?title_no=1571',
        );
    });

    it('非 200 响应直接抛错，不把错误页当数据', async () => {
        mockNetGetText.mockResolvedValue({ status: 500, body: 'oops' });
        await expect(searchWebtoons('eleceed')).rejects.toThrow(/500/);
    });
});

describe('fetchComicDetail', () => {
    it('解析详情页：标题 / 作者 / 简介 / 章节（含真实话数标题）', async () => {
        mockNetGetText.mockResolvedValue({
            status: 200,
            body: fixture('detail.html'),
        });
        const { comic, chapters } = await fetchComicDetail('1571');
        expect(comic.title).toBe('Eleceed');
        expect(comic.author).toBe('Jeho Son');
        expect(comic.intro).toContain('Jiwoo is a kind-hearted young man');
        expect(comic.cover).toContain('swebtoon-phinf.pstatic.net');
        // 3 话，按话数从大到小（最新在前）
        expect(chapters.map((c) => c.index)).toEqual([398, 397, 396]);
        // 嵌套 <span class="subj"><span>Episode 398</span>...</span> 结构
        expect(chapters[0].title).toBe('Episode 398');
        expect(chapters[2].title).toBe('Episode 396');
        expect(comic.lastChapter).toBe('Episode 398');
    });
});

describe('fetchChapterImages', () => {
    it('解析 viewer 页 _images 的真实图片 URL', async () => {
        mockNetGetText.mockResolvedValue({
            status: 200,
            body: fixture('viewer.html'),
        });
        const imgs = await fetchChapterImages('1571', 398);
        expect(imgs).toHaveLength(3);
        for (const u of imgs) {
            expect(u).toMatch(/^https:\/\/webtoon-phinf\.pstatic\.net\//);
        }
    });
});

describe('seriesUrlCache 持久化', () => {
    it('hydrate 只补充缺失项', () => {
        hydrateSeriesUrlCache({
            '1571': 'https://www.webtoons.com/en/action/eleceed/list?title_no=1571',
        });
        expect(dumpSeriesUrlCache()['1571']).toBe(
            'https://www.webtoons.com/en/action/eleceed/list?title_no=1571',
        );
        // 已有值不被覆盖
        hydrateSeriesUrlCache({ '1571': 'overwrite' });
        expect(dumpSeriesUrlCache()['1571']).toBe(
            'https://www.webtoons.com/en/action/eleceed/list?title_no=1571',
        );
    });
});
