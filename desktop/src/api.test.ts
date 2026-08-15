import { describe, it, expect, vi, beforeEach } from "vitest";

// S1 seam：api 契约。mock @tauri-apps/api/core 的 invoke，测 crawl 的
// payload 序列化/响应解析与 imgSrc 的热链重写（research #4 混合方案）。
vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { crawl, imgSrc, cimocVersion, scanLocal, listDownloaded, downloadImage } from "./api";

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

describe("scanLocal / listDownloaded / downloadImage（本地下载命令包装）", () => {
    it("scanLocal 解析返回的 JSON 数组", async () => {
        mockedInvoke.mockResolvedValue(
            JSON.stringify([{ comicId: "a", chapterCount: 3 }]),
        );
        await expect(scanLocal("/tmp/dl")).resolves.toEqual([
            { comicId: "a", chapterCount: 3 },
        ]);
        expect(mockedInvoke).toHaveBeenCalledWith("scan_local", { dir: "/tmp/dl" });
    });

    it("listDownloaded 解析章节→文件映射", async () => {
        mockedInvoke.mockResolvedValue(JSON.stringify({ "1": ["/a/1/0.jpg"] }));
        await expect(listDownloaded("/tmp/dl", "a")).resolves.toEqual({
            "1": ["/a/1/0.jpg"],
        });
        expect(mockedInvoke).toHaveBeenCalledWith("list_downloaded", {
            dir: "/tmp/dl",
            comicId: "a",
        });
    });

    it("downloadImage 把 'true'/'false' 转为布尔，referer 一并透传", async () => {
        mockedInvoke.mockResolvedValue("true");
        await expect(
            downloadImage("https://x/a.jpg", "/tmp/dl", "a", 1, 0, "https://www.webtoons.com/"),
        ).resolves.toBe(true);
        expect(mockedInvoke).toHaveBeenCalledWith("download_image", {
            url: "https://x/a.jpg",
            dir: "/tmp/dl",
            comicId: "a",
            chapterIndex: 1,
            pageIndex: 0,
            referer: "https://www.webtoons.com/",
        });
        mockedInvoke.mockResolvedValue("false");
        await expect(
            downloadImage("https://x/a.jpg", "/tmp/dl", "a", 1, 0, ""),
        ).resolves.toBe(false);
    });
});
