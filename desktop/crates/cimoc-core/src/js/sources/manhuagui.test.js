// manhuagui 源脚本 vitest 测试（wayfinder #17 双轨的 JS 侧）：
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

const api = loadSource("manhuagui");
const SEARCH = readFileSync(join(FIX, "manhuagui-search.html"), "utf8");
const DETAIL = readFileSync(join(FIX, "manhuagui-detail.html"), "utf8");
const CHAPTER = readFileSync(join(FIX, "manhuagui-chapter.html"), "utf8");

describe("manhuagui buildUrl", () => {
    it("search/category 构造 URL", () => {
        expect(api.buildUrl("search", JSON.stringify({ keyword: "音速" }), "{}")).toBe(
            "https://www.manhuagui.com/s/%E9%9F%B3%E9%80%9F_p1.html",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "热血" }), "{}")).toBe(
            "https://www.manhuagui.com/list/rexue/",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "未知" }), "{}")).toBe("");
    });

    it("detail/images 用 comicId + 章节号拼 URL", () => {
        expect(api.buildUrl("detail", JSON.stringify({ comicId: "manhuagui-43847" }), "{}")).toBe(
            "https://www.manhuagui.com/comic/43847/",
        );
        expect(
            api.buildUrl("images", JSON.stringify({ comicId: "manhuagui-43847", chapterIndex: 901676 }), "{}"),
        ).toBe("https://www.manhuagui.com/comic/43847/901676.html");
    });
});

describe("manhuagui parse", () => {
    it("categories 静态列表", () => {
        const cats = JSON.parse(api.parse("categories", "", "{}"));
        expect(cats).toHaveLength(38);
        expect(cats).toContain("热血");
        expect(cats).toContain("百合");
    });

    it("search 解析 li.cf（含封面/简介/状态）", () => {
        const comics = JSON.parse(api.parse("search", SEARCH, "{}"));
        expect(comics).toHaveLength(2);
        expect(comics[0].id).toBe("manhuagui-48320");
        expect(comics[0].title).toBe("用最强天赋开始经营领地慢生活");
        expect(comics[0].author).toContain("眠田睑");
        expect(comics[0].cover).toBe("https://cf.mhgui.com/cpic/b/48320.jpg");
        expect(comics[0].status).toBe("serial");
        expect(comics[1].status).toBe("finish");
        expect(comics[0].intro).toContain("梅尔基斯");
        expect(comics[0].lastChapter).toContain("4.2话");
    });

    it("detail 解析标题/封面/简介/章节（按 cid 升序，同类推荐被过滤）", () => {
        const detail = JSON.parse(api.parse("detail", DETAIL, JSON.stringify({ comicId: "manhuagui-43847" })));
        expect(detail.comic.title).toBe("脑洞学生会");
        expect(detail.comic.cover).toBe("https://cf.mhgui.com/cpic/h/43847_14.jpg");
        expect(detail.comic.intro).toContain("水之江梅");
        expect(detail.comic.status).toBe("serial");
        expect(detail.comic.lastChapter).toBe("第180话");
        const chapters = detail.chapters;
        expect(chapters.map((c) => c.index)).toEqual([628732, 633620, 755107, 901676]);
        expect(chapters[3].title).toBe("第180话");
        // 同类推荐里其它漫画的章节（/comic/52300/…）被过滤
        expect(chapters.every((c) => c.index !== 902850)).toBe(true);
    });

    it("chapter 解包 p.a.c.k.e.r → 图片 URL", () => {
        const urls = JSON.parse(api.parse("images", CHAPTER, "{}"));
        expect(urls).toHaveLength(4);
        expect(urls[0]).toBe(
            "https://us.hamreus.com/02/43847/901676/1_abc.jpg?e=1651837515&m=1111111111",
        );
        expect(urls[3]).toBe(
            "https://us.hamreus.com/02/43847/901676/4_jkl.jpg?e=1651837515&m=1111111111",
        );
    });

    it("无打包脚本的章节页 → 空数组", () => {
        expect(JSON.parse(api.parse("images", "<html><body>no script</body></html>", "{}"))).toEqual([]);
    });

    it("未知 op 抛错", () => {
        expect(() => api.parse("bogus", "", "{}")).toThrow();
    });
});
