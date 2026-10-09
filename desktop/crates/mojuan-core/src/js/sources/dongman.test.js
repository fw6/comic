// dongman 源脚本 vitest 测试（wayfinder #17 双轨的 JS 侧）：
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

const api = loadSource("dongman");
const SEARCH = readFileSync(join(FIX, "dongman-search.html"), "utf8");
const DETAIL = readFileSync(join(FIX, "dongman-detail.html"), "utf8");
const VIEWER = readFileSync(join(FIX, "dongman-viewer.html"), "utf8");

describe("dongman buildUrl", () => {
    it("search/category 构造 URL", () => {
        expect(api.buildUrl("search", JSON.stringify({ keyword: "甜蜜" }), "{}")).toBe(
            "https://www.dongmanmanhua.cn/search?keyword=%E7%94%9C%E8%9C%9C",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "少年" }), "{}")).toBe(
            "https://www.dongmanmanhua.cn/BOY",
        );
        expect(api.buildUrl("category", JSON.stringify({ label: "未知" }), "{}")).toBe("");
    });

    it("detail 用 titleNo 拼 episodeList；images 用 Rust 的 viewerUrl", () => {
        expect(
            api.buildUrl("detail", JSON.stringify({ comicId: "dongman-1418" }), "{}"),
        ).toBe("https://www.dongmanmanhua.cn/episodeList?titleNo=1418");
        expect(
            api.buildUrl("images", JSON.stringify({ comicId: "dongman-2859" }), JSON.stringify({ viewerUrl: "https://www.dongmanmanhua.cn/METROPOLIS/x/viewer?title_no=2859&episode_no=10" })),
        ).toBe("https://www.dongmanmanhua.cn/METROPOLIS/x/viewer?title_no=2859&episode_no=10");
        expect(
            api.buildUrl("images", JSON.stringify({ comicId: "dongman-2859" }), JSON.stringify({ viewerUrl: null })),
        ).toBe("");
    });
});

describe("dongman parse", () => {
    it("categories 静态列表", () => {
        const cats = JSON.parse(api.parse("categories", "", "{}"));
        expect(cats).toHaveLength(10);
        expect(cats).toContain("恋爱");
        expect(cats).toContain("少年");
    });

    it("search 解析卡片（过滤无 data-title-no 的首页榜单 li）", () => {
        const comics = JSON.parse(api.parse("search", SEARCH, "{}"));
        expect(comics).toHaveLength(3);
        expect(comics[0].id).toBe("dongman-1418");
        expect(comics[0].title).toBe("甜蜜保质期");
        expect(comics[0].author).toBe("黑琪可可 / 惊歌");
        expect(comics[0].cover).toMatch(/^https:\/\/cdn\.dongmanmanhua\.cn\//);
        // 首页分类榜单 li（无 data-title-no）被过滤
        expect(comics.map((c) => c.id)).not.toContain("dongman-1139");
    });

    it("detail 解析标题/作者/简介/封面/章节（降序）", () => {
        const detail = JSON.parse(api.parse("detail", DETAIL, JSON.stringify({ titleNo: "2859" })));
        expect(detail.comic.title).toBe("跳槽日志");
        expect(detail.comic.author).toBe("Woo Si-mok, Lee Ha-an");
        expect(detail.comic.intro).toContain("社恐打工人");
        expect(detail.comic.cover).toBe("https://cdn-sns.dongmanmanhua.cn/e452801b-3c10-4680-beae-63c3535baae3.jpg");
        expect(detail.comic.lastChapter).toBe("【免费】第1季后记");
        expect(detail.chapters.map((c) => c.index)).toEqual([55, 10, 9]);
        expect(detail.chapters[0].title).toBe("【免费】第1季后记");
        expect(detail.chapters[1].title).toBe("第10话");
    });

    it("viewer 解析 _images 的 data-url（排除 _thumbnailImages）", () => {
        const urls = JSON.parse(api.parse("images", VIEWER, "{}"));
        expect(urls).toHaveLength(3);
        for (const u of urls) expect(u).toMatch(/^https:\/\/cdn\.dongmanmanhua\.cn\//);
    });

    it("未知 op 抛错", () => {
        expect(() => api.parse("bogus", "", "{}")).toThrow();
    });
});
