// baozimh 源脚本 vitest 测试（wayfinder #17 双轨的 JS 侧）：
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

const api = loadSource("baozimh");
const SEARCH = readFileSync(join(FIX, "baozimh-search.html"), "utf8");
const DETAIL = readFileSync(join(FIX, "baozimh-detail.html"), "utf8");
const CHAPTER = readFileSync(join(FIX, "baozimh-chapter.html"), "utf8");

describe("baozimh buildUrl", () => {
    it("search/category/detail 构造 URL", () => {
        expect(api.buildUrl("search", JSON.stringify({ keyword: "海贼" }), "{}")).toBe(
            "https://cn.baozimh.com/search?q=%E6%B5%B7%E8%B4%BC",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "热血" }), "{}")).toBe(
            "https://cn.baozimh.com/classify?type=rexue&region=all&state=all&filter=%2a",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "未知" }), "{}")).toBe("");
        expect(api.buildUrl("detail", JSON.stringify({ comicId: "baozimh-haizeiwang-x" }), "{}")).toBe(
            "https://cn.baozimh.com/comic/haizeiwang-x",
        );
    });

    it("images 用 ctx.pageUrl（Rust 缓存的章节中转链）；缺失时为空串", () => {
        const page =
            "https://cn.baozimh.com/user/page_direct?comic_id=a_i1&section_slot=0&chapter_slot=0";
        expect(
            api.buildUrl("images", JSON.stringify({ comicId: "baozimh-a", chapterIndex: 1 }), JSON.stringify({ pageUrl: page })),
        ).toBe(page);
        expect(api.buildUrl("images", JSON.stringify({ comicId: "baozimh-a", chapterIndex: 1 }), "{}")).toBe("");
    });
});

describe("baozimh parse", () => {
    it("categories 静态列表", () => {
        const cats = JSON.parse(api.parse("categories", "", "{}"));
        expect(cats).toHaveLength(25);
        expect(cats).toContain("热血");
        expect(cats).toContain("恋爱");
    });

    it("search 解析卡片（封面在 poster 锚、作者在 info 锚）", () => {
        const comics = JSON.parse(api.parse("search", SEARCH, "{}"));
        expect(comics).toHaveLength(2);
        expect(comics[0].id).toBe("baozimh-haizeiwang-weitianrongyilang");
        expect(comics[0].source).toBe("baozimh");
        expect(comics[0].title).toBe("海贼王");
        expect(comics[0].author).toBe("尾田荣一郎");
        expect(comics[0].cover).toBe(
            "https://static-tw.baozimh.com/cover/haizeiwang-weitianrongyilang.jpg?w=285&h=375&q=100",
        );
        expect(comics[1].id).toBe("baozimh-haizeiwangyellow-weitianrongyilang");
        expect(comics[1].title).toBe("海贼王yellow");
    });

    it("detail 解析信息区 + 章节去重排序（index = 槽位升序序号）", () => {
        const detail = JSON.parse(
            api.parse("detail", DETAIL, JSON.stringify({ comicId: "baozimh-haizeiwang-weitianrongyilang" })),
        );
        expect(detail.comic.title).toBe("航海王");
        expect(detail.comic.author).toBe("尾田荣一郎");
        expect(detail.comic.intro).toContain("哥尔");
        expect(detail.comic.cover).toBe(
            "https://static-tw.baozimh.com/cover/hanghaiwang-weitianrongyilang.jpg?w=285&h=375&q=100",
        );
        expect(detail.comic.status).toBe("serial");
        expect(detail.comic.tags).toEqual(["日本", "剧情", "少年", "热血"]);
        // 页头有「最新上架」菜单，lastChapter 必须取「最新：」后的章节锚
        expect(detail.comic.lastChapter).toBe("第1186话 再一次");

        const chapters = detail.chapters;
        expect(chapters.map((c) => c.index)).toEqual([1, 2, 3, 4, 5]);
        expect(chapters[0].title).toBe("第1话 ROMANCE DAWN 冒险的序幕");
        expect(chapters[4].title).toBe("第1186话 再一次");
        // 隐藏字段 pageUrl：中转链完整 URL（Rust post_process 提取入缓存后剥离）
        expect(chapters[0].pageUrl).toContain(
            "https://cn.baozimh.com/user/page_direct?comic_id=hanghaiwang-weitianrongyilang_i6wg8y",
        );
        expect(chapters[4].pageUrl).toContain("chapter_slot=1186");
        expect(chapters.every((c) => c.external === false)).toBe(true);
    });

    it("images 解析 chapter-img amp-img（noscript/amp-state/重载按钮不混入）", () => {
        const urls = JSON.parse(api.parse("images", CHAPTER, "{}"));
        expect(urls).toHaveLength(3);
        expect(urls[0]).toBe(
            "https://s1.bzcdn.net/scomic/hanghaiwang-weitianrongyilang/0/24-3olw/1.jpg",
        );
        expect(urls[2]).toBe(
            "https://s1.bzcdn.net/scomic/hanghaiwang-weitianrongyilang/0/24-3olw/3.jpg",
        );
    });

    it("无章节图的页面 → 空数组", () => {
        expect(JSON.parse(api.parse("images", "<html><body>no images</body></html>", "{}"))).toEqual([]);
    });

    it("未知 op 抛错", () => {
        expect(() => api.parse("bogus", "", "{}")).toThrow();
    });
});
