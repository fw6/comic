import { describe, it, expect } from "vitest";
import { nearBottom, pageIndexAt, positionWithinChapter } from "./scroll";

describe("nearBottom（接近底部触发加载下一话）", () => {
    it("未接近底部返回 false", () => {
        expect(nearBottom(100, 800, 4000)).toBe(false); // (100+800)/4000 = 0.225
    });

    it("到达阈值返回 true", () => {
        expect(nearBottom(2800, 800, 4000)).toBe(true); // (2800+800)/4000 = 0.9
    });

    it("自定义阈值", () => {
        expect(nearBottom(2800, 800, 4000, 0.95)).toBe(false);
        expect(nearBottom(3000, 800, 4000, 0.95)).toBe(true); // 0.95
    });

    it("内容未溢出视口视为在底部", () => {
        expect(nearBottom(0, 800, 600)).toBe(true);
        expect(nearBottom(0, 800, 800)).toBe(true);
    });
});

describe("pageIndexAt（视口中心所在页）", () => {
    it("heights 为空返回 0", () => {
        expect(pageIndexAt(500, [])).toBe(0);
    });

    it("按累计高度定位页面", () => {
        const heights = [100, 100, 100];
        expect(pageIndexAt(0, heights)).toBe(0);
        expect(pageIndexAt(99, heights)).toBe(0);
        expect(pageIndexAt(100, heights)).toBe(1); // 边界归属下一页
        expect(pageIndexAt(250, heights)).toBe(2);
    });

    it("超出总高取最后一页", () => {
        expect(pageIndexAt(9999, [100, 100])).toBe(1);
    });
});

describe("positionWithinChapter（话内位置 0..1）", () => {
    const heights = [100, 100, 100, 100];

    it("按 [from, to) 页范围计算比例", () => {
        // 第 1~2 页（共 200 高），中心偏移 150 → 章节内前 50/200 = 0.25
        expect(positionWithinChapter(150, heights, 1, 3)).toBe(0.25);
    });

    it("超出章节范围钳制到 0/1", () => {
        expect(positionWithinChapter(0, heights, 1, 3)).toBe(0);
        expect(positionWithinChapter(9999, heights, 1, 3)).toBe(1);
    });

    it("章节高度为 0 返回 0（未测出高度）", () => {
        expect(positionWithinChapter(50, heights, 2, 2)).toBe(0);
        expect(positionWithinChapter(50, [], 0, 0)).toBe(0);
    });

    it("from 之前的页计入偏移基数", () => {
        // 第 0 页 100 高 + 第 1~2 页 200 高；中心 200 → 章节内 (200-100)/200 = 0.5
        expect(positionWithinChapter(200, heights, 1, 3)).toBe(0.5);
    });
});
