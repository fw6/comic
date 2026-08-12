/**
 * 阅读功能集成测试：真实数据链路 + 阅读进度持久化。
 * 通过注入 fake NativeModules（内存存储 + fixture 网络）模拟 Sparkling 宿主，
 * 走真实的 bridge → service → store 链路，验证：
 * - 阅读进度记录（recordHistory 带章节号）并持久化
 * - hydrateAppState 恢复进度 / 系列 URL
 * - 重启后凭持久化的系列 URL 仍能打开真实漫画与章节图片
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

const FIXTURES = join(
    process.cwd(),
    'src',
    'cimoc',
    'data',
    '__tests__',
    'fixtures',
);
function fixture(name: string): string {
    return readFileSync(join(FIXTURES, name), 'utf8');
}

// --- 模拟 Sparkling 原生宿主：通过 spkPipe 分发方法（内存存储 + 按 URL 分发 fixture 的网络）---
const storage = new Map<string, string>();

/** 按方法名分发到与原生实现一致的结果模型字段。 */
function handlePipeCall(
    method: string,
    data: unknown,
): { code: number; msg: string; data?: unknown } {
    const params = (data ?? {}) as Record<string, unknown>;
    const ok = (d: unknown) => ({ code: 1, msg: 'ok', data: d });
    const fail = (msg: string) => ({ code: 0, msg });
    switch (method) {
        case 'cimoc.getText': {
            const url = String(params.url ?? '');
            if (url.includes('search?keyword=eleceed')) {
                return ok({ status: 200, body: fixture('search-card.html') });
            }
            if (url.includes('/list?title_no=1571')) {
                return ok({ status: 200, body: fixture('detail.html') });
            }
            if (url.includes('viewer?title_no=1571')) {
                return ok({ status: 200, body: fixture('viewer.html') });
            }
            // MangaDex API（多源分派测试）
            if (url.includes('/manga/tag')) {
                return ok({ status: 200, body: fixture('mangadex-tags.json') });
            }
            if (url.includes('/at-home/server/')) {
                return ok({ status: 200, body: fixture('mangadex-at-home.json') });
            }
            if (url.includes('/manga/7e544761-7d3d-4fce-8137-719814d7d138/feed')) {
                return ok({ status: 200, body: fixture('mangadex-feed.json') });
            }
            if (url.includes('/manga/7e544761-7d3d-4fce-8137-719814d7d138')) {
                return ok({ status: 200, body: fixture('mangadex-detail.json') });
            }
            if (url.includes('/manga?title=eleceed')) {
                return ok({ status: 200, body: fixture('mangadex-search.json') });
            }
            return fail(`unknown url ${url}`);
        }
        case 'cimoc.getBytes':
            return ok({ status: 200, base64: '' });
        case 'cimoc.isNetworkAvailable':
            return ok({ available: true });
        case 'cimoc.setValue': {
            storage.set(String(params.key), String(params.value ?? ''));
            return ok({ success: true });
        }
        case 'cimoc.getValue':
            return ok({ value: storage.get(String(params.key)) ?? '' });
        case 'cimoc.removeValue': {
            storage.delete(String(params.key));
            return ok({ success: true });
        }
        case 'cimoc.listKeys':
            return ok({ keys: [...storage.keys()] });
        case 'cimoc.downloadChapter':
            return ok({ success: true });
        case 'cimoc.listDownloadedChapters':
            return ok({ chaptersJson: '{}' });
        case 'cimoc.deleteComicDownload':
            return ok({ success: true });
        case 'cimoc.getDownloadDir':
            return ok({ dir: '/downloads' });
        case 'cimoc.scanLocalComics':
            return ok({ comicsJson: '[]' });
        case 'cimoc.listLocalChapters':
            return ok({ chaptersJson: '[]' });
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
