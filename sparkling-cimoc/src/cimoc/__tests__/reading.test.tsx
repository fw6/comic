/**
 * 阅读功能集成测试：真实数据链路 + 阅读进度持久化。
 * 通过注入 fake NativeModules（内存存储 + fixture 网络）模拟 Sparkling 宿主，
 * 走真实的 bridge → service → store 链路，验证：
 * - 阅读进度记录（recordHistory 带章节号）并持久化
 * - hydrateAppState 恢复进度 / 系列 URL
 * - 重启后凭持久化的系列 URL 仍能打开真实漫画与章节图片
 */
import { render } from '@lynx-js/react/testing-library';
import { getDefaultStore } from 'jotai';
import { describe, expect, it, vi } from 'vitest';

import {
    loadChapterImages,
    loadChapters,
    loadComic,
    searchComics,
    sourceList,
} from '../data/service.js';
import { historyAtom, progressAtom, useAppStore } from '../store.js';
import type { AppStore } from '../store.js';

// --- 模拟 Sparkling 原生宿主：通过 spkPipe 分发方法（内存存储 + Rust 爬虫结果桩）---
const storage = new Map<string, string>();
// 模拟 Rust 侧 webtoons 系列 URL 缓存（search 写入 / cache_dump 导出 / cache_hydrate 回填）
const rustWebtoonsCache = new Map<string, string>();

/** 按方法名分发到与原生实现一致的结果模型字段。 */
function handlePipeCall(
    method: string,
    data: unknown,
): { code: number; msg: string; data?: unknown } {
    const params = (data ?? {}) as Record<string, unknown>;
    const ok = (d: unknown) => ({ code: 1, msg: 'ok', data: d });
    const fail = (msg: string) => ({ code: 0, msg });
    switch (method) {
        case 'cimoc.crawl': {
            const op = String(params.op ?? '');
            const sourceId = String(params.sourceId ?? '');
            const payload = JSON.parse(String(params.payload ?? '{}')) as Record<
                string,
                unknown
            >;
            if (sourceId === 'webtoons') {
                const comic = {
                    id: 'webtoons-1571',
                    source: 'webtoons',
                    sourceTitle: 'Webtoons',
                    title: 'Eleceed',
                    author: '',
                    intro: '',
                    cover: 'https://webtoon-phinf.pstatic.net/1571.jpg',
                    status: 'serial',
                    updateTime: '',
                    lastChapter: '',
                    tags: [],
                    lastReadChapter: 0,
                    lastReadTime: 0,
                };
                switch (op) {
                    case 'categories':
                        return ok({
                            json: JSON.stringify([
                                '动作', '恋爱', '搞笑', '剧情', '奇幻', '恐怖', '科幻', '体育',
                            ]),
                        });
                    case 'search':
                    case 'category':
                        rustWebtoonsCache.set(
                            '1571',
                            'https://www.webtoons.com/en/action/eleceed/list?title_no=1571',
                        );
                        return ok({ json: JSON.stringify([comic]) });
                    case 'detail':
                        return ok({
                            json: JSON.stringify({
                                comic,
                                chapters: [398, 397, 396].map((i) => ({
                                    index: i,
                                    title: `Episode ${i}`,
                                    pages: [],
                                    downloaded: false,
                                    read: false,
                                })),
                            }),
                        });
                    case 'images':
                        return ok({
                            json: JSON.stringify([
                                'https://webtoon-phinf.pstatic.net/a.jpg',
                                'https://webtoon-phinf.pstatic.net/b.jpg',
                                'https://webtoon-phinf.pstatic.net/c.jpg',
                            ]),
                        });
                    case 'cache_dump':
                        return ok({
                            json: JSON.stringify(Object.fromEntries(rustWebtoonsCache)),
                        });
                    case 'cache_hydrate':
                        for (const [k, v] of Object.entries(payload)) {
                            if (!rustWebtoonsCache.has(k)) {
                                rustWebtoonsCache.set(k, String(v));
                            }
                        }
                        return ok({ json: 'true' });
                }
            }
            if (sourceId === 'mangadex') {
                const eleceed = {
                    id: 'mangadex-7e544761-7d3d-4fce-8137-719814d7d138',
                    source: 'mangadex',
                    sourceTitle: 'MangaDex',
                    title: 'Eleceed',
                    author: 'Son Jae-Ho',
                    intro: 'kind-hearted',
                    cover: 'https://uploads.mangadex.org/covers/7e544761-7d3d-4fce-8137-719814d7d138/x.256.jpg',
                    status: 'serial',
                    updateTime: '',
                    lastChapter: '',
                    tags: ['Action'],
                    lastReadChapter: 0,
                    lastReadTime: 0,
                };
                switch (op) {
                    case 'categories':
                        return ok({ json: JSON.stringify(['Action', 'Romance', 'Fantasy']) });
                    case 'search':
                        return ok({
                            json: JSON.stringify([
                                eleceed,
                                {
                                    id: 'mangadex-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                                    source: 'mangadex',
                                    sourceTitle: 'MangaDex',
                                    title: 'Eleceed Another',
                                    author: '',
                                    intro: '',
                                    cover: '',
                                    status: 'finish',
                                    updateTime: '',
                                    lastChapter: '',
                                    tags: [],
                                    lastReadChapter: 0,
                                    lastReadTime: 0,
                                },
                            ]),
                        });
                    case 'category':
                        return ok({ json: JSON.stringify([eleceed]) });
                    case 'detail':
                        return ok({
                            json: JSON.stringify({
                                comic: eleceed,
                                chapters: [
                                    { index: 1, title: 'Welcome', pages: [], downloaded: false, read: false },
                                    { index: 2, title: '第 2 话', pages: [], downloaded: false, read: false },
                                    { index: 3, title: 'Rival', pages: [], downloaded: false, read: false },
                                ],
                            }),
                        });
                    case 'images':
                        return ok({
                            json: JSON.stringify([
                                'https://cmdxd98sb0x3yprd.mangadex.network/data/hash/f1-x.png',
                                'https://cmdxd98sb0x3yprd.mangadex.network/data/hash/f2-x.png',
                            ]),
                        });
                }
            }
            return fail(`unknown crawl ${sourceId}/${op}`);
        }
        case 'storage.setItem': {
            storage.set(String(params.key), String(params.data ?? ''));
            return ok({});
        }
        case 'storage.getItem':
            return ok({ data: storage.get(String(params.key)) ?? '' });
        case 'cimoc.downloadChapter':
            return ok({ success: true });
        case 'cimoc.listDownloadedChapters':
            return ok({ chaptersJson: '{}' });
        case 'cimoc.scanLocalComics':
            return ok({ comicsJson: '[]' });
        case 'cimoc.pickFolder':
            return ok({ success: true });
        case 'cimoc.webdavPutFile':
            return ok({ success: true, status: 201 });
        case 'cimoc.webdavGetFile':
            return ok({ ok: false });
        default:
            return fail(`unknown method ${method}`);
    }
}

const fakeNativeModules = {
    spkPipe: {
        call: (
            method: string,
            payload: { data?: unknown },
            cb: (v: unknown) => void,
        ) => {
            cb(handlePipeCall(method, payload.data));
        },
    },
} as unknown as Record<string, Record<string, (...args: unknown[]) => void>>;
(globalThis as unknown as Record<string, unknown>).NativeModules =
    fakeNativeModules;

// --- 通过真实渲染获取 store hook 实例（recordHistory 等逻辑在 useAppStore 内）---
let storeRef: AppStore | null = null;
function Harness(): null {
    storeRef = useAppStore();
    return null;
}

describe('阅读进度记录', () => {
    it('进入阅读器后记录历史与进度，并持久化到原生存储', () => {
        render(<Harness />);
        storeRef!.recordHistory('webtoons-1571', 398);

        // atom 状态同步更新（不依赖组件重渲染时序）
        const store = getDefaultStore();
        expect(store.get(historyAtom)[0]).toBe('webtoons-1571');
        expect(store.get(progressAtom)['webtoons-1571']).toMatchObject({
            chapter: 398,
        });

        // 持久化：StorageModule 中应有 history 与 progress
        const persistedHistory = JSON.parse(storage.get('history')!) as string[];
        expect(persistedHistory[0]).toBe('webtoons-1571');
        const persistedProgress = JSON.parse(storage.get('progress')!) as Record<
            string,
            { chapter: number; time: number }
        >;
        expect(persistedProgress['webtoons-1571'].chapter).toBe(398);
        expect(persistedProgress['webtoons-1571'].time).toBeGreaterThan(0);
    });

    it('再次阅读同一漫画：历史置顶，进度更新为最新章节', () => {
        render(<Harness />);
        storeRef!.recordHistory('webtoons-1571', 398);
        storeRef!.recordHistory('comic-0', 1);
        storeRef!.recordHistory('webtoons-1571', 397);

        const store = getDefaultStore();
        // 默认历史保留在尾部，最近阅读置顶
        expect(store.get(historyAtom).slice(0, 2)).toEqual([
            'webtoons-1571',
            'comic-0',
        ]);
        expect(store.get(progressAtom)['webtoons-1571']?.chapter).toBe(397);
    });
});

describe('启动恢复', () => {
    it('hydrateAppState 从原生存储恢复历史与进度', async () => {
        storage.set('history', JSON.stringify(['comic-0', 'comic-1']));
        storage.set(
            'progress',
            JSON.stringify({
                'webtoons-1571': { chapter: 400, time: 1234 },
            }),
        );
        storage.set(
            'series-urls',
            JSON.stringify({
                '1571': 'https://www.webtoons.com/en/action/eleceed/list?title_no=1571',
            }),
        );

        const { hydrateAppState } = await import('../store.js');
        await hydrateAppState();

        const store = getDefaultStore();
        expect(store.get(historyAtom)).toEqual(['comic-0', 'comic-1']);
        expect(store.get(progressAtom)['webtoons-1571']).toEqual({
            chapter: 400,
            time: 1234,
        });
    });
});

describe('真实数据链路（走原生桥）', () => {
    it('搜索解析后持久化真实系列 URL（含 genre slug）', async () => {
        storage.delete('series-urls');
        const { searchComics } = await import('../data/service.js');
        const results = await searchComics('eleceed');
        expect(results[0].title).toBe('Eleceed');
        expect(results[0].id).toBe('webtoons-1571');

        const urls = JSON.parse(storage.get('series-urls')!) as Record<
            string,
            string
        >;
        expect(urls['1571']).toContain('/action/eleceed/list');
    });

    it('详情 / 章节 / 图片：真实 URL 解析并成功持久化', async () => {
        // 模拟同一会话中已通过搜索发现系列 URL
        storage.set(
            'series-urls',
            JSON.stringify({
                '1571': 'https://www.webtoons.com/en/action/eleceed/list?title_no=1571',
            }),
        );
        const comic = await loadComic('webtoons-1571');
        expect(comic?.title).toBe('Eleceed');
        expect(comic?.cover).toContain('pstatic.net');

        const chapters = await loadChapters('webtoons-1571');
        expect(chapters).toHaveLength(3);
        expect(chapters[0].title).toBe('Episode 398');

        const imgs = await loadChapterImages('webtoons-1571', 398);
        expect(imgs).toHaveLength(3);
        expect(imgs[0]).toMatch(/^https:\/\/webtoon-phinf\.pstatic\.net\//);
    });

    it('重启后（重新加载模块、清空内存缓存）凭持久化的系列 URL 仍可打开', async () => {
        // 前一个用例已把真实系列 URL 落盘
        const urls = JSON.parse(storage.get('series-urls')!) as Record<
            string,
            string
        >;
        expect(urls['1571']).toContain('/action/eleceed/list');

        vi.resetModules();
        const svc = await import('../data/service.js');

        const comic = await svc.loadComic('webtoons-1571');
        expect(comic?.title).toBe('Eleceed');

        const imgs = await svc.loadChapterImages('webtoons-1571', 398);
        expect(imgs).toHaveLength(3);
        expect(imgs[0]).toMatch(/^https:\/\//);
    });
});

describe('多图源分派（注册表）', () => {
    it('sourceList 只返回真实图源（无 mock）', () => {
        const sources = sourceList();
        expect(sources.map((s) => s.id).sort()).toEqual([
            'mangadex',
            'webtoons',
        ]);
    });

    it('searchComics 跨多图源并发搜索并合并去重', async () => {
        const results = await searchComics('eleceed', ['webtoons', 'mangadex']);
        const ids = results.map((c) => c.id);
        // webtoons 1 条（webtoons-1571）+ mangadex 2 条
        expect(ids).toContain('webtoons-1571');
        expect(ids).toContain('mangadex-7e544761-7d3d-4fce-8137-719814d7d138');
        expect(ids).toContain('mangadex-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        expect(new Set(ids).size).toBe(ids.length); // 无重复
        const titles = results.map((c) => c.title);
        expect(titles.filter((t) => t === 'Eleceed')).toHaveLength(2); // 两源同名
    });

    it('loadComic / loadChapters / loadChapterImages 按前缀路由到 MangaDex', async () => {
        const comic = await loadComic(
            'mangadex-7e544761-7d3d-4fce-8137-719814d7d138',
        );
        expect(comic?.title).toBe('Eleceed');
        expect(comic?.source).toBe('mangadex');

        const chapters = await loadChapters(
            'mangadex-7e544761-7d3d-4fce-8137-719814d7d138',
        );
        expect(chapters.map((c) => c.index)).toEqual([1, 2, 3]);

        const imgs = await loadChapterImages(
            'mangadex-7e544761-7d3d-4fce-8137-719814d7d138',
            1,
        );
        expect(imgs).toHaveLength(2);
        expect(imgs[0]).toMatch(/^https:\/\/.*\.mangadex\.network\/data\//);
    });

    it('未知前缀的漫画如实返回空（无 mock 回退）', async () => {
        expect(await loadComic('unknown-1')).toBeNull();
        expect(await loadChapters('unknown-1')).toEqual([]);
        expect(await loadChapterImages('unknown-1', 1)).toEqual([]);
    });
});
