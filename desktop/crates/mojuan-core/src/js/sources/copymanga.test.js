// copymanga 源脚本 vitest 测试（wayfinder #17 双轨的 JS 侧）：
// 与 Rust 引擎冒烟（tests/source_script_test.rs）同一批 fixture，同一批断言——
// 但跑在 node 环境，验证脚本逻辑本身；引擎环境偏差由 Rust 冒烟兜底。

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "crates/mojuan-core/src/js/sources");
const FIX = join(process.cwd(), "crates/mojuan-core/tests/fixtures");

function loadSource(name) {
    const code = readFileSync(join(SRC, `${name}.js`), "utf8");
    const sandbox = {};
    return new Function("globalThis", `${code}\n;return globalThis.__source;`)(sandbox);
}

const api = loadSource("copymanga");
const SEARCH = readFileSync(join(FIX, "copymanga-search.json"), "utf8");
const DETAIL = readFileSync(join(FIX, "copymanga-detail.json"), "utf8");
const FEED = JSON.parse(readFileSync(join(FIX, "copymanga-feed.json"), "utf8"));
const CHAPTER = readFileSync(join(FIX, "copymanga-chapter.json"), "utf8");

describe("copymanga buildUrl", () => {
    it("search/category 构造 URL", () => {
        expect(api.buildUrl("search", JSON.stringify({ keyword: "海贼王" }), "{}")).toBe(
            "https://api.mangacopy.com/api/v3/search/comic?format=json&platform=3&q=%E6%B5%B7%E8%B4%BC%E7%8E%8B&offset=0&limit=20",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "冒险" }), "{}")).toBe(
            "https://api.mangacopy.com/api/v3/comics?platform=3&limit=20&offset=0&theme=maoxian",
        );
    });

    it("detail/images 用 path_word 拼 URL，无 chapterUuid 返回空串", () => {
        expect(api.buildUrl("detail", JSON.stringify({ comicId: "copymanga-haizeiwang" }), "{}")).toBe(
            "https://api.mangacopy.com/api/v3/comic2/haizeiwang?platform=3",
        );
        expect(
            api.buildUrl("images", JSON.stringify({ comicId: "copymanga-haizeiwang" }), JSON.stringify({ chapterUuid: "ch-1" })),
        ).toBe("https://api.mangacopy.com/api/v3/comic/haizeiwang/chapter2/ch-1?platform=3");
        expect(
            api.buildUrl("images", JSON.stringify({ comicId: "copymanga-haizeiwang" }), JSON.stringify({ chapterUuid: null })),
        ).toBe("");
    });
});

describe("copymanga parse", () => {
    it("categories 静态列表", () => {
        const cats = JSON.parse(api.parse("categories", "", "{}"));
        expect(cats).toHaveLength(17);
        expect(cats).toContain("冒险");
        expect(cats).toContain("百合");
    });

    it("search 解析列表", () => {
        const comics = JSON.parse(api.parse("search", SEARCH, "{}"));
        expect(comics).toHaveLength(3);
        expect(comics[0].id).toBe("copymanga-haizeiwang");
        expect(comics[0].title).toBe("海贼王");
        expect(comics[0].author).toBe("尾田栄一郎");
        expect(comics[0].cover).toMatch(/^https:\/\//);
    });

    it("detail 解析 comic + 章节（feed 升序）", () => {
        const ctx = JSON.stringify({ feed: FEED.results.list });
        const detail = JSON.parse(api.parse("detail", DETAIL, ctx));
        expect(detail.comic.title).toBe("海贼王");
        expect(detail.comic.author).toBe("尾田栄一郎");
        expect(detail.comic.status).toBe("serial");
        expect(detail.comic.lastChapter).toBe("第 1000 话");
        expect(detail.chapters.map((c) => c.index)).toEqual([1, 2, 3]);
        expect(detail.chapters[0].title).toBe("第 1 话");
    });

    it("chapter 解析图片 contents[].url", () => {
        const urls = JSON.parse(api.parse("images", CHAPTER, "{}"));
        expect(urls).toHaveLength(2);
        expect(urls[0]).toMatch(/^https:\/\/sh\.mangafunb\.fun\//);
    });

    it("未知 op 抛错", () => {
        expect(() => api.parse("bogus", "", "{}")).toThrow();
    });
});
