import { describe, it, expect, beforeEach } from "vitest";
import {
    SOURCES,
    applyBundledSources,
    hotlinkRefererFor,
    sourceReferer,
    sourceTitle,
    type SourceFacts,
} from "./sources";

// 源清单与按源事实（显示名、图片热链对）由 Rust 侧注册表经 bundled_sources 提供，
// initSources 就绪后填充一次。这里验证填充与两个查询。

const BUNDLED: SourceFacts[] = [
    { id: "mangadex", title: "MangaDex", hotlinkReferers: [] },
    {
        id: "webtoons",
        title: "Webtoons",
        hotlinkReferers: [{ domain: "pstatic.net", referer: "https://www.webtoons.com/" }],
    },
    {
        id: "dongman",
        title: "咚漫",
        hotlinkReferers: [
            { domain: "dongmanmanhua.cn", referer: "https://www.dongmanmanhua.cn/" },
        ],
    },
];

beforeEach(() => {
    applyBundledSources(BUNDLED, {});
});

describe("applyBundledSources", () => {
    it("清单按注册表顺序填充", () => {
        expect(SOURCES.map((s) => s.id)).toEqual(["mangadex", "webtoons", "dongman"]);
    });

    it("显示名优先取已装源的 name（源仓库可改名）", () => {
        applyBundledSources(BUNDLED, { webtoons: { name: "Webtoons 改名" } });
        expect(sourceTitle("webtoons")).toBe("Webtoons 改名");
        expect(sourceTitle("mangadex")).toBe("MangaDex");
    });

    it("重复填充重置清单，不累加", () => {
        applyBundledSources(BUNDLED, {});
        applyBundledSources(BUNDLED, {});
        expect(SOURCES).toHaveLength(3);
    });

    it("未知源的标题回退到 id", () => {
        expect(sourceTitle("nope")).toBe("nope");
    });
});

describe("热链对查询", () => {
    it("imgSrc 用：按 URL 子串命中域名", () => {
        expect(hotlinkRefererFor("https://s.pstatic.net/a/1.webp")).toBe(
            "https://www.webtoons.com/",
        );
        expect(hotlinkRefererFor("https://cdn.dongmanmanhua.cn/a/1.jpg")).toBe(
            "https://www.dongmanmanhua.cn/",
        );
        expect(hotlinkRefererFor("https://uploads.mangadex.org/a.jpg")).toBeNull();
    });

    it("下载用：取该源声明的 Referer，没有声明返回空串", () => {
        expect(sourceReferer("webtoons")).toBe("https://www.webtoons.com/");
        expect(sourceReferer("mangadex")).toBe("");
        expect(sourceReferer("nope")).toBe("");
    });
});
