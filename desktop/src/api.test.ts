import { describe, it, expect, vi, beforeEach } from "vitest";

// S1 seam：api 契约。mock @tauri-apps/api/core 的 invoke，测 crawl 的
// payload 序列化/响应解析与 imgSrc 的热链重写（research #4 混合方案）。
vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
    crawl,
    imgSrc,
    localSrc,
    cimocVersion,
    scanLocal,
    listDownloaded,
    enqueueDownload,
    getDownloads,
    cancelDownload,
    retryDownload,
    clearDownloads,
    subscribeDownloads,
} from "./api";

const mockedInvoke = vi.mocked(invoke);

beforeEach(() => {
    mockedInvoke.mockReset();
});

describe("imgSrc（热链域 → cimoc-img:// 代理，其余直连）", () => {
    it("把 pstatic.net 热链图重写为 cimoc-img 代理，带 url 与 ref 参数", () => {
        const src = imgSrc("https://s.pstatic.net/dummy/cover.webp");
        expect(src).toBe(
            "cimoc-img://localhost/img?url=" +
                encodeURIComponent("https://s.pstatic.net/dummy/cover.webp") +
                "&ref=" +
                encodeURIComponent("https://www.webtoons.com/"),
        );
    });

    it("非热链域保持直连（吃 webview HTTP 缓存）", () => {
        const src = "https://uploads.mangadex.org/covers/abc/def.jpg";
        expect(imgSrc(src)).toBe(src);
    });
});

describe("crawl（invoke 包装：payload 序列化 + JSON 解析）", () => {
    it("把 op/source/payload 以 JSON 字符串传给 crawl 命令并解析响应", async () => {
        mockedInvoke.mockResolvedValue(
            JSON.stringify([{ id: "a", title: "漫" }]),
        );
        const result = await crawl<{ id: string }[]>("search", "mangadex", {
            keyword: "one piece",
        });
        expect(mockedInvoke).toHaveBeenCalledWith("crawl", {
            op: "search",
            source: "mangadex",
            payload: JSON.stringify({ keyword: "one piece" }),
        });
        expect(result).toEqual([{ id: "a", title: "漫" }]);
    });

    it("invoke 被拒绝时原样抛出", async () => {
        mockedInvoke.mockRejectedValue(new Error("command failed"));
        await expect(
            crawl("search", "mangadex", { keyword: "x" }),
        ).rejects.toThrow("command failed");
    });

    it("响应不是合法 JSON 时拒绝（JSON.parse 抛错）", async () => {
        mockedInvoke.mockResolvedValue("{broken");
        await expect(crawl("search", "mangadex", { keyword: "x" })).rejects.toThrow();
    });
});

describe("cimocVersion", () => {
    it("透传 invoke 返回值", async () => {
        mockedInvoke.mockResolvedValue("0.1.0");
        await expect(cimocVersion()).resolves.toBe("0.1.0");
        expect(mockedInvoke).toHaveBeenCalledWith("cimoc_version");
    });
});

describe("localSrc（wayfinder #19：本地文件路径 → cimoc-img 本地模式）", () => {
    it("把绝对路径重写为 cimoc-img://localhost/file?path=…", () => {
        const p = "/Users/me/Downloads/cimoc/webtoons/c1/chapter_1/0.jpg";
        expect(localSrc(p)).toBe(
            `cimoc-img://localhost/file?path=${encodeURIComponent(p)}`,
        );
    });
});

describe("scanLocal / listDownloaded / downloadImage（本地下载命令包装）", () => {
    it("scanLocal 解析返回的 JSON 数组（含 source）", async () => {
        mockedInvoke.mockResolvedValue(
            JSON.stringify([{ source: "webtoons", comicId: "a", chapterCount: 3 }]),
        );
        await expect(scanLocal("/tmp/dl")).resolves.toEqual([
            { source: "webtoons", comicId: "a", chapterCount: 3 },
        ]);
        expect(mockedInvoke).toHaveBeenCalledWith("scan_local", { dir: "/tmp/dl" });
    });

    it("listDownloaded 带 source 解析章节→文件映射", async () => {
        mockedInvoke.mockResolvedValue(JSON.stringify({ "1": ["/a/1/0.jpg"] }));
        await expect(listDownloaded("/tmp/dl", "webtoons", "a")).resolves.toEqual({
            "1": ["/a/1/0.jpg"],
        });
        expect(mockedInvoke).toHaveBeenCalledWith("list_downloaded", {
            dir: "/tmp/dl",
            source: "webtoons",
            comicId: "a",
        });
    });
});

describe("下载任务队列 API（wayfinder #20/#22/#23）", () => {
    it("enqueueDownload 把入队参数透传给 enqueue_download 并解析结果", async () => {
        mockedInvoke.mockResolvedValue(
            JSON.stringify({
                result: "queued",
                progress: { taskId: "webtoons/a/1", status: "queued", done: 0, total: 3 },
            }),
        );
        const out = await enqueueDownload({
            source: "webtoons",
            comicId: "a",
            comicTitle: "标题",
            chapterIndex: 1,
            dir: "/tmp/dl",
            referer: "https://www.webtoons.com/",
            urls: ["https://x/0.jpg", "https://x/1.jpg", "https://x/2.jpg"],
        });
        expect(out.result).toBe("queued");
        expect(out.progress.total).toBe(3);
        expect(mockedInvoke).toHaveBeenCalledWith("enqueue_download", {
            source: "webtoons",
            comicId: "a",
            comicTitle: "标题",
            chapterIndex: 1,
            dir: "/tmp/dl",
            referer: "https://www.webtoons.com/",
            urls: ["https://x/0.jpg", "https://x/1.jpg", "https://x/2.jpg"],
        });
    });

    it("getDownloads 解析快照数组（含展示字段）", async () => {
        mockedInvoke.mockResolvedValue(
            JSON.stringify([
                {
                    taskId: "webtoons/a/1",
                    source: "webtoons",
                    comicId: "a",
                    comicTitle: "标题",
                    chapterIndex: 1,
                    status: "downloading",
                    done: 2,
                    total: 3,
                },
            ]),
        );
        const list = await getDownloads();
        expect(list).toHaveLength(1);
        expect(list[0].comicTitle).toBe("标题");
        expect(mockedInvoke).toHaveBeenCalledWith("get_downloads");
    });

    it("cancelDownload/retryDownload 解析进度或 null", async () => {
        mockedInvoke.mockResolvedValue(
            JSON.stringify({ taskId: "a", status: "cancelled", done: 0, total: 3 }),
        );
        await expect(cancelDownload("a")).resolves.toMatchObject({ status: "cancelled" });
        expect(mockedInvoke).toHaveBeenCalledWith("cancel_download", { taskId: "a" });

        mockedInvoke.mockResolvedValue(
            JSON.stringify({ taskId: "a", status: "queued", done: 0, total: 3 }),
        );
        await expect(retryDownload("a")).resolves.toMatchObject({ status: "queued" });
        expect(mockedInvoke).toHaveBeenCalledWith("retry_download", { taskId: "a" });

        mockedInvoke.mockResolvedValue("null");
        await expect(cancelDownload("missing")).resolves.toBeNull();
    });

    it("clearDownloads 返回移除数量", async () => {
        mockedInvoke.mockResolvedValue(2);
        await expect(clearDownloads()).resolves.toBe(2);
        expect(mockedInvoke).toHaveBeenCalledWith("clear_downloads");
    });

    it("subscribeDownloads 把 Channel 传给 subscribe_downloads", async () => {
        const channel = { id: 1 };
        await subscribeDownloads(channel as never);
        expect(mockedInvoke).toHaveBeenCalledWith("subscribe_downloads", { channel });
    });
});
