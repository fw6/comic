// nnhanman 源脚本 vitest 测试（wayfinder #17 双轨的 JS 侧）：
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

const api = loadSource("nnhanman");
const SEARCH = readFileSync(join(FIX, "nnhanman-search.html"), "utf8");
const DETAIL = readFileSync(join(FIX, "nnhanman-detail.html"), "utf8");
const CHAPTER = readFileSync(join(FIX, "nnhanman-chapter.html"), "utf8");

describe("nnhanman buildUrl", () => {
    it("search/category 构造 URL", () => {
        expect(api.buildUrl("search", JSON.stringify({ keyword: "韓" }), "{}")).toBe(
            "https://nnhanman.xyz/catalog.php?key=%E9%9F%93",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "热门" }), "{}")).toBe(
            "https://nnhanman.xyz/comics/all/ob/hits/st/all",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "恋爱" }), "{}")).toBe(
            "https://nnhanman.xyz/comics/%E6%81%8B%E7%88%B1/ob/time/st/all",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "不存在" }), "{}")).toBe("");
    });

    it("detail/images 用 slug + 章节号拼 URL", () => {
        expect(
            api.buildUrl("detail", JSON.stringify({ comicId: "nnhanman-zui-bang-de-ta" }), "{}"),
        ).toBe("https://nnhanman.xyz/comic/zui-bang-de-ta.html");
        expect(
            api.buildUrl(
                "images",
                JSON.stringify({ comicId: "nnhanman-zui-bang-de-ta", chapterIndex: 85993 }),
                "{}",
            ),
        ).toBe("https://nnhanman.xyz/comic/zui-bang-de-ta/chapter-85993.html");
    });
});

describe("nnhanman parse", () => {
    it("categories 静态列表（4 个总览 + 20 个题材）", () => {
        const cats = JSON.parse(api.parse("categories", "", "{}"));
        expect(cats).toHaveLength(24);
        expect(cats[0]).toBe("最新更新");
        expect(cats).toContain("恋爱");
        expect(cats).toContain("日漫");
    });

    it("search 解析 col_3_1 卡片（封面取 picture 里的 img，info 日期不当章节）", () => {
        const comics = JSON.parse(api.parse("search", SEARCH, "{}"));
        expect(comics).toHaveLength(3);
        expect(comics[0].id).toBe("nnhanman-lian-ai-zuo-bi-bai-ke");
        expect(comics[0].title).toBe("戀愛作弊百科");
        expect(comics[0].source).toBe("nnhanman");
        expect(comics[0].cover).toBe("https://new.niaopic.com/202608/20260818135631986.jpg");
        expect(comics[0].lastChapter).toBe("");
    });

    it("detail 解析标题/作者/题材/简介/章节（倒序表转升序，「开始阅读」按钮不污染标题）", () => {
        const detail = JSON.parse(
            api.parse("detail", DETAIL, JSON.stringify({ comicId: "nnhanman-zui-bang-de-ta" })),
        );
        expect(detail.comic.title).toBe("最棒的她");
        expect(detail.comic.author).toBe("BYUK CHA");
        expect(detail.comic.intro).toContain("青梅竹馬的媽媽");
        expect(detail.comic.cover).toBe("https://new.niaopic.com/202609/20260929145709400.jpg");
        expect(detail.comic.status).toBe("serial");
        expect(detail.comic.tags[0]).toBe("正妹");
        expect(detail.comic.lastChapter).toBe("第5話");
        const chapters = detail.chapters;
        expect(chapters.map((c) => c.index)).toEqual([85989, 85990, 85991, 85992, 85993]);
        expect(chapters[0].title).toBe("第1話");
    });

    it("chapter 取带 data-index 的图（统计像素与站内 logo 排除）", () => {
        const urls = JSON.parse(api.parse("images", CHAPTER, "{}"));
        expect(urls).toHaveLength(4);
        expect(urls[0]).toBe("https://new.niaopic.com/2026092914/20260929144622267.jpg");
        // 末图只有 src、没有 data-src，回落到 src
        expect(urls[3]).toBe("https://new.niaopic.com/2026092914/20260929144917909.jpg");
    });

    it("未知 op 抛错", () => {
        expect(() => api.parse("bogus", "", "{}")).toThrow();
    });
});
