import { describe, it, expect, beforeEach, vi } from "vitest";

// S3 seam：源域（已装源同步 + 源进程内缓存的持久化）。mock 插件层与 core invoke。

vi.mock("@tauri-apps/plugin-store", async () => (await import("./test-doubles")).storePlugin);
vi.mock("@tauri-apps/api/core", async () => ({
    invoke: (await import("./test-doubles")).invokeMock,
}));

import {
    hydrateSourceCaches,
    persistSourceCache,
    whenSourcesReady,
} from "./sources";
import { invokeMock, resetDoubles, storePlugin } from "./test-doubles";

beforeEach(() => {
    resetDoubles();
});

describe("源进程内缓存的持久化", () => {
    it("hydrate：把各源已存映射回灌 Rust 进程内缓存", async () => {
        invokeMock.mockResolvedValue(JSON.stringify({}));
        const store = await storePlugin.load("sources-cache.json");
        await store.set("caches", {
            webtoons: { "1571": "https://www.webtoons.com/x/list?title_no=1571" },
        });
        await hydrateSourceCaches();
        expect(invokeMock).toHaveBeenCalledWith("crawl", {
            op: "cache_hydrate",
            source: "webtoons",
            payload: JSON.stringify({ "1571": "https://www.webtoons.com/x/list?title_no=1571" }),
        });
    });

    it("hydrate：无已存数据时不做任何调用", async () => {
        await hydrateSourceCaches();
        expect(invokeMock).not.toHaveBeenCalled();
    });

    it("persist：把 cache_dump 结果按源写入存储", async () => {
        invokeMock.mockResolvedValue(
            JSON.stringify({ "1571": "https://www.webtoons.com/x/list?title_no=1571" }),
        );
        await persistSourceCache("webtoons");
        const store = await storePlugin.load("sources-cache.json");
        expect(await store.get("caches")).toEqual({
            webtoons: { "1571": "https://www.webtoons.com/x/list?title_no=1571" },
        });
    });

    it("persist：该源没有持久缓存（dump 出空对象）时不写存储", async () => {
        invokeMock.mockResolvedValue(JSON.stringify({}));
        await persistSourceCache("hentara");
        const store = await storePlugin.load("sources-cache.json");
        expect(await store.get("caches")).toBeUndefined();
    });
});

describe("whenSourcesReady（源脚本同步单例）", () => {
    it("并发与重复调用共享同一次同步（sync_sources 只发一次）", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "bundled_sources") {
                return [
                    {
                        id: "mangadex",
                        title: "MangaDex",
                        script: "script-v1",
                        hotlinkReferers: [],
                    },
                ];
            }
            return undefined;
        });
        await Promise.all([whenSourcesReady(), whenSourcesReady()]);
        await whenSourcesReady();
        const syncCalls = invokeMock.mock.calls.filter(([cmd]) => cmd === "sync_sources");
        expect(syncCalls).toHaveLength(1);
        expect(syncCalls[0][1]).toEqual({ entries: { mangadex: "script-v1" } });
    });
});
