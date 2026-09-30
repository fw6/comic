// kxmanhua 源脚本 vitest 测试（wayfinder #17 双轨的 JS 侧）：
// 与 Rust 引擎冒烟（tests/source_script_test.rs）同一批 fixture，同一批断言——
// 但跑在 node 环境，验证脚本逻辑本身；引擎环境偏差由 Rust 冒烟兜底。

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "crates/cimoc-core/src/js/sources");
const FIX = join(process.cwd(), "crates/cimoc-core/tests/fixtures");

function loadSource(name) {
    const code = readFileSync(join(SRC, `${name}.js`), "utf8");
    const sandbox = {};
    return new Function("globalThis", `${code}\n;return globalThis.__source;`)(sandbox);
}

const api = loadSource("kxmanhua");
const SEARCH = readFileSync(join(FIX, "kxmanhua-search.html"), "utf8");
const DETAIL = readFileSync(join(FIX, "kxmanhua-detail.html"), "utf8");
const CHAPTER = readFileSync(join(FIX, "kxmanhua-chapter.html"), "utf8");

describe("kxmanhua buildUrl", () => {
    it("search/category 构造 URL", () => {
        expect(api.buildUrl("search", JSON.stringify({ keyword: "最棒" }), "{}")).toBe(
            "https://kxmanhua.com/manga/search?keyword=%E6%9C%80%E6%A3%92",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "韩漫" }), "{}")).toBe(
            "https://kxmanhua.com/manga/library?type=2",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "不存在" }), "{}")).toBe("");
    });

    it("detail/images 用漫画号 + 章节号拼 URL", () => {
        expect(api.buildUrl("detail", JSON.stringify({ comicId: "kxmanhua-7067" }), "{}")).toBe(
            "https://kxmanhua.com/manga/7067",
        );
        expect(
            api.buildUrl("images", JSON.stringify({ comicId: "kxmanhua-7067", chapterIndex: 173807 }), "{}"),
        ).toBe("https://kxmanhua.com/manga/7067/detail/173807");
    });
});

describe("kxmanhua parse", () => {
    it("categories 静态列表", () => {
        const cats = JSON.parse(api.parse("categories", "", "{}"));
        expect(cats).toHaveLength(10);
        expect(cats[0]).toBe("最新上架");
        expect(cats).toContain("韩漫");
    });

    it("search 解析卡片（无 title 属性时取锚文本；完结态 epgreen）", () => {
        const comics = JSON.parse(api.parse("search", SEARCH, "{}"));
        expect(comics).toHaveLength(2);
        expect(comics[0].id).toBe("kxmanhua-7067");
        expect(comics[0].title).toBe("最棒的她");
        expect(comics[0].source).toBe("kxmanhua");
        expect(comics[0].status).toBe("serial");
        expect(comics[0].cover).toBe(
            "https://img.imh99.top/webtoon/cover-image/4085_1790735521874.webp",
        );
        expect(comics[1].id).toBe("kxmanhua-3915");
        expect(comics[1].title).toBe("[3D]奸魔再世");
        expect(comics[1].status).toBe("finish");
    });

    it("detail 解析标题/作者/简介/封面/章节（同类推荐的完结态不污染 status）", () => {
        const detail = JSON.parse(
            api.parse("detail", DETAIL, JSON.stringify({ comicId: "kxmanhua-7067" })),
        );
        expect(detail.comic.title).toBe("最棒的她");
        expect(detail.comic.author).toBe("BYUK CHA");
        expect(detail.comic.intro).toContain("青梅竹马的妈妈");
        expect(detail.comic.cover).toBe(
            "https://img.imh99.top/webtoon/cover-image/4085_1790735521874.webp",
        );
        expect(detail.comic.status).toBe("serial");
        expect(detail.comic.lastChapter).toBe("第5话");
        const chapters = detail.chapters;
        expect(chapters.map((c) => c.index)).toEqual([173803, 173804, 173805, 173806, 173807]);
        expect(chapters[0].title).toBe("第1话");
    });

    it("chapter 只取 /webtoon/content/ 的章节图（logo 与广告位排除）", () => {
        const urls = JSON.parse(api.parse("images", CHAPTER, "{}"));
        expect(urls).toHaveLength(3);
        expect(urls[0]).toBe(
            "https://img.imh99.top/webtoon/content/4085/114628/000_1790738399524.webp",
        );
        expect(urls[2]).toBe(
            "https://img.imh99.top/webtoon/content/4085/114628/002_1790738399527.webp",
        );
    });

    it("未知 op 抛错", () => {
        expect(() => api.parse("bogus", "", "{}")).toThrow();
    });
});
