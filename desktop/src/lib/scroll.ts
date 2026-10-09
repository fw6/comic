/** 卷纸流滚动窗口计算（S4 seam，纯函数；jsdom 测不了真实滚动，逻辑抽出来测）。 */

/** 距底部不足 marginPx 像素（触发预取下一话）。内容未溢出视口视为在底部。 */
export function nearBottomByPx(
    scrollTop: number,
    clientHeight: number,
    scrollHeight: number,
    marginPx: number,
): boolean {
    if (scrollHeight <= clientHeight) return true;
    return scrollHeight - (scrollTop + clientHeight) <= marginPx;
}

/** 视口中心偏移所在页（按已测页面高度累计定位）。heights 为空返回 0。 */
export function pageIndexAt(centerOffset: number, heights: number[]): number {
    if (heights.length === 0) return 0;
    let acc = 0;
    for (let i = 0; i < heights.length; i++) {
        acc += heights[i];
        if (centerOffset < acc) return i;
    }
    return heights.length - 1;
}

/** 在 [from, to) 页范围内的话内位置 0..1（按已测高度）。 */
export function positionWithinChapter(
    centerOffset: number,
    heights: number[],
    from: number,
    to: number,
): number {
    const before = sum(heights, 0, from);
    const total = sum(heights, from, to);
    if (total <= 0) return 0;
    const within = Math.min(total, Math.max(0, centerOffset - before));
    return within / total;
}

function sum(heights: number[], from: number, to: number): number {
    let s = 0;
    for (let i = from; i < to && i < heights.length; i++) s += heights[i];
    return s;
}
