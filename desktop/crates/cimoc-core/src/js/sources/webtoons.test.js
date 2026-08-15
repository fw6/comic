// webtoons 源脚本 vitest 测试（wayfinder #17 双轨的 JS 侧）：
// 与 Rust 引擎冒烟（tests/source_script_test.rs）同一批 fixture，同一批断言——
// 但跑在 node 环境，验证脚本逻辑本身；引擎环境偏差由 Rust 冒烟兜底。

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// vitest 从 desktop/ 运行：cwd = 仓库 desktop，路径相对它（import.meta.url 在 vite 转换下不可靠）
const SRC = join(process.cwd(), "crates/cimoc-core/src/js/sources");
const FIX = join(process.cwd(), "crates/cimoc-core/tests/fixtures");

function loadSource(name) {
    const code = readFileSync(join(SRC, `${name}.js`), "utf8");
    const sandbox = {};
    // 脚本只声明全局函数 + globalThis.__source 导出；sandbox 当 QuickJS global 用
    return new Function("globalThis", `${code}\n;return globalThis.__source;`)(sandbox);
}

const api = loadSource("webtoons");
const SEARCH_CARD = readFileSync(join(FIX, "search-card.html"), "utf8");
const DETAIL_HTML = readFileSync(join(FIX, "detail.html"), "utf8");
const VIEWER = readFileSync(join(FIX, "viewer.html"), "utf8");

describe("webtoons buildUrl", () => {
    it("search/category 构造 URL", () => {
        expect(api.buildUrl("search", JSON.stringify({ keyword: "eleceed" }), "{}")).toContain(
            "/en/search?keyword=",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "恋爱" }), "{}")).toBe(
            "https://www.webtoons.com/en/genres/romance",
        );
    });

    it("detail 优先缓存的 seriesUrl，否则 any 兜底", () => {
        const series = "https://www.webtoons.com/en/action/eleceed/list?title_no=1571";
        expect(
            api.buildUrl("detail", JSON.stringify({ comicId: "webtoons-1571" }), JSON.stringify({ seriesUrl: series })),
        ).toBe(series);
        expect(
            api.buildUrl("detail", JSON.stringify({ comicId: "webtoons-1571" }), JSON.stringify({ seriesUrl: "" })),
        ).toBe("https://www.webtoons.com/en/any/list?title_no=1571");
    });

    it("images 用 slug 拼 viewer 路径", () => {
        const series = "https://www.webtoons.com/en/action/eleceed/list?title_no=1571";
        expect(
            api.buildUrl(
                "images",
                JSON.stringify({ comicId: "webtoons-1571", chapterIndex: 398 }),
                JSON.stringify({ seriesUrl: series }),
            ),
        ).toBe(
            "https://www.webtoons.com/en/action/eleceed/episode-398/viewer?title_no=1571&episode_no=398",
        );
    });
});

describe("webtoons parse", () => {
    it("categories 静态列表", () => {
        expect(JSON.parse(api.parse("categories", "", "{}"))).toHaveLength(8);
    });

    it("search 解析系列卡片（含隐藏 seriesUrl）", () => {
        const comics = JSON.parse(api.parse("search", SEARCH_CARD, "{}"));
        expect(comics).toHaveLength(1);
        expect(comics[0].id).toBe("webtoons-1571");
        expect(comics[0].title).toBe("Eleceed");
        expect(comics[0].cover).toContain("webtoon-phinf.pstatic.net");
        expect(comics[0].seriesUrl).toBe(
            "https://www.webtoons.com/en/action/eleceed/list?title_no=1571",
        );
    });

    it("detail 解析标题/作者/简介/封面/章节（降序）", () => {
        const detail = JSON.parse(
            api.parse("detail", DETAIL_HTML, JSON.stringify({ titleNo: "1571" })),
        );
        expect(detail.comic.title).toBe("Eleceed");
        expect(detail.comic.author).toBe("Jeho Son");
        expect(detail.comic.intro).toContain("Jiwoo is a kind-hearted young man");
        expect(detail.comic.cover).toContain("swebtoon-phinf.pstatic.net");
        expect(detail.chapters.map((c) => c.index)).toEqual([398, 397, 396]);
        expect(detail.chapters[0].title).toBe("Episode 398");
        expect(detail.comic.lastChapter).toBe("Episode 398");
    });

    it("viewer 解析图片 data-url", () => {
        const urls = JSON.parse(api.parse("images", VIEWER, "{}"));
        expect(urls).toHaveLength(3);
        for (const u of urls) expect(u).toMatch(/^https:\/\/webtoon-phinf\.pstatic\.net\//);
    });

    it("未知 op 抛错", () => {
        expect(() => api.parse("bogus", "", "{}")).toThrow();
    });
});
