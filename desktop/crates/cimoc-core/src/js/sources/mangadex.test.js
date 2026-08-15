// mangadex 源脚本 vitest 测试（wayfinder #17 双轨的 JS 侧）：
// 与 Rust 引擎冒烟（tests/source_script_test.rs）同一批 fixture，同一批断言。

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// vitest 从 desktop/ 运行：cwd = 仓库 desktop，路径相对它（import.meta.url 在 vite 转换下不可靠）
const SRC = join(process.cwd(), "crates/cimoc-core/src/js/sources");
const FIX = join(process.cwd(), "crates/cimoc-core/tests/fixtures");

function loadSource(name) {
    const code = readFileSync(join(SRC, `${name}.js`), "utf8");
    const sandbox = {};
    return new Function("globalThis", `${code}\n;return globalThis.__source;`)(sandbox);
}

const api = loadSource("mangadex");
const SEARCH = readFileSync(join(FIX, "mangadex-search.json"), "utf8");
const DETAIL = readFileSync(join(FIX, "mangadex-detail.json"), "utf8");
const FEED = JSON.parse(readFileSync(join(FIX, "mangadex-feed.json"), "utf8"));
const AT_HOME = readFileSync(join(FIX, "mangadex-at-home.json"), "utf8");

describe("mangadex buildUrl", () => {
    it("search 带标题与内容分级", () => {
        const url = api.buildUrl("search", JSON.stringify({ keyword: "eleceed" }), "{}");
        expect(url).toContain("https://api.mangadex.org/manga?title=");
        expect(url).toContain("contentRating[]=safe");
    });

    it("category 用 ctx.tagId；无 tagId 返回空串", () => {
        const tagId = "391b0423-d847-456f-aff0-8b0cfc03066b";
        expect(
            api.buildUrl("category", JSON.stringify({ label: "Action" }), JSON.stringify({ tagId })),
        ).toContain(`includedTags[]=${tagId}`);
        expect(api.buildUrl("category", JSON.stringify({ label: "Nope" }), "{}")).toBe("");
    });

    it("detail / images 路径", () => {
        const comicId = "mangadex-7e544761-7d3d-4fce-8137-719814d7d138";
        expect(api.buildUrl("detail", JSON.stringify({ comicId }), "{}")).toBe(
            "https://api.mangadex.org/manga/7e544761-7d3d-4fce-8137-719814d7d138?includes[]=author&includes[]=artist&includes[]=cover_art",
        );
        const chapterId = "59dcd5b1-8d41-4940-b5c6-60c684be5f69";
        expect(
            api.buildUrl(
                "images",
                JSON.stringify({ comicId: "mangadex-x", chapterIndex: 1 }),
                JSON.stringify({ chapterId }),
            ),
        ).toBe(`https://api.mangadex.org/at-home/server/${chapterId}`);
        expect(api.buildUrl("images", JSON.stringify({ comicId: "mangadex-x" }), "{}")).toBe("");
    });
});

describe("mangadex parse", () => {
    it("search 解析漫画列表", () => {
        const comics = JSON.parse(api.parse("search", SEARCH, "{}"));
        expect(comics).toHaveLength(2);
        expect(comics[0].id).toBe("mangadex-7e544761-7d3d-4fce-8137-719814d7d138");
        expect(comics[0].title).toBe("Eleceed");
        expect(comics[0].author).toBe("Son Jae-Ho");
        expect(comics[0].cover).toMatch(/^https:\/\/uploads\.mangadex\.org\/covers\/.*\.256\.jpg$/);
        expect(comics[0].status).toBe("serial");
        expect(comics[0].tags).toContain("Action");
        expect(comics[0].intro).toContain("kind-hearted");
        expect(comics[1].status).toBe("finish");
    });

    it("detail 解析漫画 + 章节（含外链标记）", () => {
        const detail = JSON.parse(
            api.parse("detail", DETAIL, JSON.stringify({ feed: FEED.data })),
        );
        expect(detail.comic.title).toBe("Eleceed");
        expect(detail.chapters.map((c) => c.index)).toEqual([1, 2, 3]);
        expect(detail.chapters[0].title).toBe("Welcome");
        expect(detail.chapters[1].title).toBe("第 2 话");
        expect(detail.chapters.map((c) => c.external)).toEqual([false, true, false]);
        expect(detail.comic.lastChapter).toBe("Rival");
    });

    it("at-home 解析图片 URL", () => {
        const urls = JSON.parse(api.parse("images", AT_HOME, "{}"));
        expect(urls).toHaveLength(2);
        expect(urls[0]).toMatch(/^https:\/\/cmdxd98sb0x3yprd\.mangadex\.network\/data\/5ee6f31f/);
        expect(urls[0]).toContain("/f1-");
    });

    it("未知 op 抛错", () => {
        expect(() => api.parse("bogus", "", "{}")).toThrow();
    });
});
