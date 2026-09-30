// hentara 源脚本 vitest 测试（wayfinder #17 双轨的 JS 侧）：
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

const api = loadSource("hentara");
const INDEX = readFileSync(join(FIX, "hentara-index.json"), "utf8");
const BROWSE = readFileSync(join(FIX, "hentara-browse.html"), "utf8");
const GENRE = readFileSync(join(FIX, "hentara-genre.html"), "utf8");
const DETAIL = readFileSync(join(FIX, "hentara-detail.json"), "utf8");
const EPISODE = readFileSync(join(FIX, "hentara-episode.json"), "utf8");

describe("hentara buildUrl", () => {
    it("search 取 index.json（站内搜索由前端在目录上过滤）", () => {
        expect(api.buildUrl("search", JSON.stringify({ keyword: "harem" }), "{}")).toBe(
            "https://cdn.hentara.com/data/index.json",
        );
    });

    it("category 构造列表页 URL", () => {
        expect(api.buildUrl("category", JSON.stringify({ label: "全部" }), "{}")).toBe(
            "https://hentara.com/browse",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "Harem" }), "{}")).toBe(
            "https://hentara.com/genres/harem-manhwa",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "不存在" }), "{}")).toBe("");
    });

    it("detail/images 走站点数据接口", () => {
        expect(api.buildUrl("detail", JSON.stringify({ comicId: "hentara-capitalist-harem" }), "{}")).toBe(
            "https://cdn.hentara.com/data/comics/capitalist-harem.json",
        );
        expect(
            api.buildUrl("images", JSON.stringify({ comicId: "hentara-capitalist-harem", chapterIndex: 1 }), "{}"),
        ).toBe("https://cdn.hentara.com/data/episodes/capitalist-harem/1.json");
    });
});

describe("hentara parse", () => {
    it("categories 静态列表", () => {
        const cats = JSON.parse(api.parse("categories", "", "{}"));
        expect(cats).toHaveLength(18);
        expect(cats[0]).toBe("全部");
        expect(cats).toContain("Doujinshi");
    });

    it("search 在 index.json 上过滤（大小写不敏感，按更新排前）", () => {
        const comics = JSON.parse(api.parse("search", INDEX, JSON.stringify({ keyword: "harem" })));
        expect(comics).toHaveLength(2);
        expect(comics[0].id).toBe("hentara-capitalist-harem");
        expect(comics[0].title).toBe("Capitalist Harem");
        expect(comics[0].cover).toBe("https://cdn.hentara.com/capitalist-harem/thumbnail.jpg");
        expect(comics[0].lastChapter).toBe("Chapter 14");
        expect(comics.every((c) => c.id !== "hentara-1-day-1-girl")).toBe(true);

        const upper = JSON.parse(api.parse("search", INDEX, JSON.stringify({ keyword: "HAREM" })));
        expect(upper).toHaveLength(2);
    });

    it("category 解析列表页卡片（pg-card / genre-card 两种形态）", () => {
        const browse = JSON.parse(api.parse("category", BROWSE, "{}"));
        expect(browse).toHaveLength(2);
        expect(browse[0].id).toBe("hentara-heart-pounding-s-matching");
        expect(browse[0].title).toBe("Heart Pounding S Matching (Uncensored)");
        expect(browse[0].cover).toBe(
            "https://cdn.hentara.com/heart-pounding-s-matching/thumbnail.jpg",
        );

        const genre = JSON.parse(api.parse("category", GENRE, "{}"));
        expect(genre).toHaveLength(2);
        expect(genre[0].id).toBe("hentara-teach-me-first");
        expect(genre[0].title).toBe("Teach Me First! (Uncensored)");
    });

    it("detail 解析 comic + episodes（按话数升序，标题空时兜底）", () => {
        const detail = JSON.parse(api.parse("detail", DETAIL, "{}"));
        expect(detail.comic.id).toBe("hentara-capitalist-harem");
        expect(detail.comic.title).toBe("Capitalist Harem");
        expect(detail.comic.cover).toBe("https://cdn.hentara.com/capitalist-harem/thumbnail.jpg");
        expect(detail.comic.lastChapter).toBe("Chapter 14");
        expect(detail.chapters).toHaveLength(14);
        expect(detail.chapters[0].index).toBe(1);
        expect(detail.chapters[13].index).toBe(14);
        expect(detail.chapters[0].title).toBe("Chapter 1");
    });

    it("chapter 取 pages 里的图片 URL", () => {
        const urls = JSON.parse(api.parse("images", EPISODE, "{}"));
        expect(urls).toHaveLength(14);
        expect(urls[0]).toBe("https://cdn.hentara.com/capitalist-harem/chapter-001/001.jpg");
        expect(urls[13]).toBe("https://cdn.hentara.com/capitalist-harem/chapter-001/014.jpg");
    });

    it("未知 op 抛错", () => {
        expect(() => api.parse("bogus", "", "{}")).toThrow();
    });
});
