import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sources from "./Sources";
import type { Comic } from "../api";

// vitest 不开 globals（vite.config.ts：#10 seam 测试显式 import）→ RTL 不会自动
// cleanup，DOM 会跨用例泄漏。手动在 afterEach 清理。

// S1 seam：Sources 页（书源 List 页面，tab 切换）。mock api 层，
// 验证分类 tab / 源 tab / 搜索三种加载路径与错误行展示。

vi.mock("../api", () => ({
    crawl: vi.fn(),
    cimocVersion: vi.fn().mockResolvedValue("test"),
    sourceErrors: vi.fn().mockResolvedValue({}),
    imgSrc: (url: string) => url,
}));

vi.mock("../lib/storage", () => ({
    persistWebtoonsCache: vi.fn().mockResolvedValue(undefined),
}));

import { crawl, sourceErrors } from "../api";
import { persistWebtoonsCache } from "../lib/storage";

const mockedCrawl = vi.mocked(crawl);
const mockedErrors = vi.mocked(sourceErrors);

function comic(over: Partial<Comic> = {}): Comic {
    return {
        id: "x",
        source: "mangadex",
        sourceTitle: "MangaDex",
        title: "海贼王",
        author: "尾田荣一郎",
        intro: "",
        cover: "https://example.com/c.jpg",
        status: "serial",
        updateTime: "",
        lastChapter: "",
        tags: [],
        lastReadChapter: 0,
        lastReadTime: 0,
        ...over,
    };
}

/** categories → [动作, 恋爱]；category 按 label 返回单条漫画；search 返回一条。 */
function setupCrawl() {
    mockedCrawl.mockImplementation((op: string, source: string, payload: unknown) => {
        if (op === "categories") return Promise.resolve(["动作", "恋爱"]);
        const p = (payload ?? {}) as { label?: string; keyword?: string };
        if (op === "category") {
            return Promise.resolve([
                comic({ id: `${source}-${p.label}`, title: `${source}-${p.label}` }),
            ]);
        }
        if (op === "search") {
            return Promise.resolve([comic({ id: `s-${p.keyword}`, title: p.keyword ?? "" })]);
        }
        return Promise.resolve([]);
    });
}

function renderSources() {
    return render(
        <MemoryRouter>
            <Sources />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    setupCrawl();
});

afterEach(() => {
    cleanup();
});

describe("Sources 书源 List 页面（tab 切换）", () => {
    it("挂载即加载分类 tab，默认加载第一个分类的列表", async () => {
        renderSources();
        expect(await screen.findByRole("tab", { name: "动作" })).toBeTruthy();
        expect(screen.getByRole("tab", { name: "恋爱" })).toBeTruthy();
        await waitFor(() =>
            expect(mockedCrawl).toHaveBeenCalledWith("category", "mangadex", {
                label: "动作",
            }),
        );
        expect(await screen.findByText("mangadex-动作")).toBeTruthy();
    });

    it("切换分类 tab 重新加载该分类列表", async () => {
        renderSources();
        await screen.findByRole("tab", { name: "恋爱" });
        fireEvent.click(screen.getByRole("tab", { name: "恋爱" }));
        await waitFor(() =>
            expect(mockedCrawl).toHaveBeenCalledWith("category", "mangadex", {
                label: "恋爱",
            }),
        );
        expect(await screen.findByText("mangadex-恋爱")).toBeTruthy();
    });

    it("切换源 tab 重新加载该源的分类与列表", async () => {
        renderSources();
        await screen.findByRole("tab", { name: "动作" });
        fireEvent.click(screen.getByRole("tab", { name: "Webtoons" }));
        await waitFor(() =>
            expect(mockedCrawl).toHaveBeenCalledWith("categories", "webtoons", {}),
        );
        await waitFor(() =>
            expect(mockedCrawl).toHaveBeenCalledWith("category", "webtoons", {
                label: "动作",
            }),
        );
        expect(await screen.findByText("webtoons-动作")).toBeTruthy();
    });

    it("搜索触发 search op，Webtoons 源搜索后回灌缓存", async () => {
        renderSources();
        await screen.findByRole("tab", { name: "动作" });
        fireEvent.change(screen.getByPlaceholderText("搜索漫画标题…"), {
            target: { value: "海贼王" },
        });
        fireEvent.click(screen.getByRole("button", { name: "搜索" }));
        await waitFor(() =>
            expect(mockedCrawl).toHaveBeenCalledWith("search", "mangadex", {
                keyword: "海贼王",
            }),
        );
        // mangadex 源不触发 webtoons 缓存
        expect(persistWebtoonsCache).not.toHaveBeenCalled();
    });

    it("Webtoons 源列表加载后回灌 series URL 缓存", async () => {
        mockedCrawl.mockImplementation((op: string, source: string, payload: unknown) => {
            if (op === "categories") return Promise.resolve(["动作"]);
            const p = (payload ?? {}) as { label?: string };
            if (op === "category") {
                return Promise.resolve([
                    comic({ id: `webtoons-1`, source: "webtoons", title: `${source}-${p.label}` }),
                ]);
            }
            return Promise.resolve([]);
        });
        renderSources();
        await screen.findByRole("tab", { name: "动作" });
        fireEvent.click(screen.getByRole("tab", { name: "Webtoons" }));
        await waitFor(() => expect(persistWebtoonsCache).toHaveBeenCalled());
    });

    it("源错误行显示最近一次错误（wayfinder #17）", async () => {
        mockedCrawl.mockImplementation((op: string) => {
            if (op === "categories") return Promise.resolve(["动作"]);
            return Promise.resolve([]);
        });
        mockedErrors.mockResolvedValue({
            mangadex: { message: "fetch(category): boom\n@1:2", at: 1 },
        });
        renderSources();
        expect(await screen.findByText(/加载失败：fetch\(category\): boom/)).toBeTruthy();
    });
});
