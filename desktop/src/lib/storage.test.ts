import { describe, it, expect, beforeEach, vi } from "vitest";

// S3 seam：数据层（进度/历史/收藏/设置）。mock @tauri-apps/plugin-store，
// 用内存 fake store 按 path 隔离，验证本模块的自有逻辑（键合成、排序、合并、去重）。

const mocks = vi.hoisted(() => {
    const dataByPath = new Map<string, Map<string, unknown>>();
    // 动态查表：store 实例（storage.ts 的 storeCache 会跨用例缓存）始终指向当前 Map，
    // reset 后旧实例也能看到清空后的状态。
    const storeFor = (path: string) => {
        if (!dataByPath.has(path)) dataByPath.set(path, new Map());
        return dataByPath.get(path)!;
    };
    return {
        load: async (path: string) => ({
            get: async (k: string) => storeFor(path).get(k),
            set: async (k: string, v: unknown) => {
                storeFor(path).set(k, v);
            },
            has: async (k: string) => storeFor(path).has(k),
            delete: async (k: string) => storeFor(path).delete(k),
            entries: async <T>() =>
                [...storeFor(path).entries()] as Array<[string, T]>,
            clear: async () => {
                storeFor(path).clear();
            },
            save: async () => {},
        }),
        reset: () => {
            for (const m of dataByPath.values()) m.clear();
            dataByPath.clear();
        },
    };
});

vi.mock("@tauri-apps/plugin-store", () => ({ load: mocks.load }));
vi.mock("@tauri-apps/api/path", () => ({
    downloadDir: async () => "/mock/Downloads",
}));

// storage-fs.ts（移动端存储层，wayfinder #31）：mock plugin-fs 四个函数，内存文件系统。
const fsMocks = vi.hoisted(() => {
    const files = new Map<string, string>();
    return {
        readTextFile: vi.fn(async (path: string) => {
            const v = files.get(path);
            if (v === undefined) throw new Error("file not found");
            return v;
        }),
        writeTextFile: vi.fn(async (path: string, data: string) => {
            files.set(path, data);
        }),
        mkdir: vi.fn(async () => {}),
        files,
    };
});

vi.mock("@tauri-apps/plugin-fs", () => ({
    BaseDirectory: { AppData: 14 },
    readTextFile: fsMocks.readTextFile,
    writeTextFile: fsMocks.writeTextFile,
    mkdir: fsMocks.mkdir,
}));

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import {
    getProgress,
    setProgress,
    getHistory,
    touchHistory,
    getFavorites,
    isFavorite,
    toggleFavorite,
    getSettings,
    setSettings,
    comicKey,
    hydrateWebtoonsCache,
    persistWebtoonsCache,
    exportBackupJson,
    parseBackupJson,
    importBackupData,
    BACKUP_VERSION,
} from "./storage";
import { getStore as getFsStore } from "./storage-fs";
import type { Comic } from "../api";

const comic = (id: string, source = "mangadex"): Comic => ({
    id,
    source,
    sourceTitle: "MangaDex",
    title: `作品 ${id}`,
    author: "作者",
    intro: "",
    cover: "https://example.com/cover.jpg",
    status: "ongoing",
    updateTime: "",
    lastChapter: "1",
    tags: [],
    lastReadChapter: 0,
    lastReadTime: 0,
});

beforeEach(() => {
    mocks.reset();
});

describe("comicKey", () => {
    it("合成 (source, comicId) 跨域唯一键", () => {
        expect(comicKey("webtoons", "abc")).toBe("webtoons:abc");
    });
});

describe("进度 progress", () => {
    it("setProgress 后 getProgress 可读回，键按 source:comicId 隔离", async () => {
        await setProgress("mangadex", "c1", {
            chapterIndex: 3,
            position: 0.5,
            updatedAt: 1000,
        });
        await expect(getProgress("mangadex", "c1")).resolves.toEqual({
            chapterIndex: 3,
            position: 0.5,
            updatedAt: 1000,
        });
        await expect(getProgress("mangadex", "c2")).resolves.toBeNull();
        await expect(getProgress("webtoons", "c1")).resolves.toBeNull();
    });

    it("重读覆盖旧进度", async () => {
        await setProgress("mangadex", "c1", {
            chapterIndex: 1,
            position: 0.2,
            updatedAt: 100,
        });
        await setProgress("mangadex", "c1", {
            chapterIndex: 2,
            position: 0.8,
            updatedAt: 200,
        });
        await expect(getProgress("mangadex", "c1")).resolves.toMatchObject({
            chapterIndex: 2,
            position: 0.8,
        });
    });
});

describe("历史 history", () => {
    it("touch 记录漫画+章节，按最近阅读倒序", async () => {
        await touchHistory(comic("a"), 1);
        await touchHistory(comic("b"), 2);
        const list = await getHistory();
        expect(list.map((r) => r.comic.id)).toEqual(["b", "a"]);
    });

    it("重读同一漫画移到最前并更新章节", async () => {
        await touchHistory(comic("a"), 1);
        await touchHistory(comic("b"), 2);
        await touchHistory(comic("a"), 5);
        const list = await getHistory();
        expect(list.map((r) => r.comic.id)).toEqual(["a", "b"]);
        expect(list[0].chapterIndex).toBe(5);
    });
});

describe("收藏 favorites", () => {
    it("toggle 添加再移除，返回切换后状态", async () => {
        await expect(toggleFavorite(comic("a"))).resolves.toBe(true);
        await expect(isFavorite("mangadex", "a")).resolves.toBe(true);
        await expect(getFavorites()).resolves.toHaveLength(1);
        await expect(toggleFavorite(comic("a"))).resolves.toBe(false);
        await expect(isFavorite("mangadex", "a")).resolves.toBe(false);
        await expect(getFavorites()).resolves.toHaveLength(0);
    });

    it("不同源同 id 互不冲突", async () => {
        await toggleFavorite(comic("a", "mangadex"));
        await toggleFavorite(comic("a", "webtoons"));
        await expect(getFavorites()).resolves.toHaveLength(2);
    });
});

describe("设置 settings", () => {
    it("未设置时返回默认值（下载目录 = ~/Downloads/cimoc）", async () => {
        await expect(getSettings()).resolves.toEqual({
            downloadDir: "/mock/Downloads/cimoc",
            darkMode: false,
            autoTrim: false,
        });
    });

    it("部分更新与已有设置合并，不互相覆盖", async () => {
        await setSettings({ darkMode: true });
        await setSettings({ autoTrim: true });
        await expect(getSettings()).resolves.toEqual({
            downloadDir: "/mock/Downloads/cimoc",
            darkMode: true,
            autoTrim: true,
        });
    });
});

describe("WebDAV 备份/恢复（wayfinder #24/#25）", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("exportBackupJson 聚合三域为 {version, exportedAt, favorites, history, progress}", async () => {
        await toggleFavorite(comic("a", "mangadex"));
        await touchHistory(comic("b", "webtoons"), 2);
        await setProgress("mangadex", "a", {
            chapterIndex: 3,
            position: 0.5,
            updatedAt: 1000,
        });
        const json = await exportBackupJson();
        const data = JSON.parse(json) as ReturnType<typeof parseBackupJson>;
        expect(data.version).toBe(BACKUP_VERSION);
        expect(typeof data.exportedAt).toBe("number");
        expect(data.favorites[comicKey("mangadex", "a")].title).toBe("作品 a");
        expect(data.history[comicKey("webtoons", "b")].chapterIndex).toBe(2);
        expect(data.progress[comicKey("mangadex", "a")].position).toBe(0.5);
    });

    it("parseBackupJson 接受当前版本、拒绝其他版本", () => {
        const good = JSON.stringify({
            version: BACKUP_VERSION,
            exportedAt: 1,
            favorites: {},
            history: {},
            progress: {},
        });
        expect(parseBackupJson(good).version).toBe(BACKUP_VERSION);
        const bad = good.replace(`"version":${BACKUP_VERSION}`, '"version":999');
        expect(() => parseBackupJson(bad)).toThrow(/不受支持/);
    });

    it("importBackupData 整体覆盖本地三域（快照语义）", async () => {
        await toggleFavorite(comic("old", "mangadex"));
        await importBackupData({
            version: BACKUP_VERSION,
            exportedAt: 1,
            favorites: { [comicKey("mangadex", "new")]: comic("new", "mangadex") },
            history: {
                [comicKey("webtoons", "h")]: {
                    comic: comic("h", "webtoons"),
                    chapterIndex: 5,
                    lastReadAt: 2000,
                },
            },
            progress: {
                [comicKey("mangadex", "new")]: {
                    chapterIndex: 7,
                    position: 0.9,
                    updatedAt: 3000,
                },
            },
        });
        const favs = await getFavorites();
        expect(favs.map((c) => c.id)).toEqual(["new"]);
        const his = await getHistory();
        expect(his.map((r) => r.comic.id)).toEqual(["h"]);
        await expect(getProgress("mangadex", "new")).resolves.toMatchObject({
            chapterIndex: 7,
        });
        await expect(getProgress("mangadex", "old")).resolves.toBeNull();
    });
});

describe("storage-fs（移动端存储层，wayfinder #31）", () => {
    beforeEach(() => {
        fsMocks.files.clear();
        fsMocks.readTextFile.mockClear();
        fsMocks.writeTextFile.mockClear();
        fsMocks.mkdir.mockClear();
    });

    it("set/get/has/entries：首启空对象，写入后读回", async () => {
        const s = getFsStore("progress.json");
        await expect(s.get("a")).resolves.toBeUndefined();
        await s.set("k", { v: 1 });
        await expect(s.get("k")).resolves.toEqual({ v: 1 });
        await expect(s.has("k")).resolves.toBe(true);
        await expect(s.entries()).resolves.toEqual([["k", { v: 1 }]]);
        // 写盘调用：recursive mkdir 建 bootstrap 子目录（顺带建 appDataDir，fs scope 只放行子路径）+ writeTextFile 落盘
        expect(fsMocks.mkdir).toHaveBeenCalledWith("cimoc", expect.objectContaining({ recursive: true }));
        expect(fsMocks.writeTextFile).toHaveBeenCalledWith(
            "progress.json",
            JSON.stringify({ k: { v: 1 } }),
            expect.anything(),
        );
    });

    it("delete/clear 后 get 为空；delete 不存在的 key 返回 false", async () => {
        const s = getFsStore("favorites.json");
        await s.set("a", 1);
        await expect(s.delete("missing")).resolves.toBe(false);
        await expect(s.delete("a")).resolves.toBe(true);
        await expect(s.has("a")).resolves.toBe(false);
        await s.clear();
        await expect(s.entries()).resolves.toEqual([]);
    });

    it("损坏的 JSON 回退空对象，不抛错", async () => {
        fsMocks.files.set("broken.json", "{not json");
        const s = getFsStore("broken.json");
        await expect(s.entries()).resolves.toEqual([]);
    });

    it("save 是兼容占位（fs 已即时落盘）", async () => {
        const s = getFsStore("settings.json");
        await expect(s.save()).resolves.toBeUndefined();
    });
});

describe("Webtoons series URL 缓存持久化", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("hydrate：把已存映射回灌 Rust 进程内缓存", async () => {
        invokeMock.mockResolvedValue(JSON.stringify({}));
        const store = await mocks.load("webtoons-cache.json");
        await store.set("cache", { "1571": "https://www.webtoons.com/x/list?title_no=1571" });
        await hydrateWebtoonsCache();
        expect(invokeMock).toHaveBeenCalledWith("crawl", {
            op: "cache_hydrate",
            source: "webtoons",
            payload: JSON.stringify({ "1571": "https://www.webtoons.com/x/list?title_no=1571" }),
        });
    });

    it("hydrate：无已存数据时不做任何调用", async () => {
        await hydrateWebtoonsCache();
        expect(invokeMock).not.toHaveBeenCalled();
    });

    it("persist：把 cache_dump 结果写入存储", async () => {
        invokeMock.mockResolvedValue(
            JSON.stringify({ "1571": "https://www.webtoons.com/x/list?title_no=1571" }),
        );
        await persistWebtoonsCache();
        const store = await mocks.load("webtoons-cache.json");
        expect(await store.get("cache")).toEqual({
            "1571": "https://www.webtoons.com/x/list?title_no=1571",
        });
    });
});
