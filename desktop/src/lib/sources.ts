/** 漫画源的前端事实：清单（显示名）与按源声明的图片热链对。
 * 全部来自 Rust 侧的源注册表（`bundled_sources`），启动同步源之后填充一次。 */

/** 已接入的漫画源（顺序 = 源注册表的注册顺序，首个为默认源）。 */
export interface SourceEntry {
    id: string;
    title: string;
}

/** 图片热链对：CDN 域名 → 需带上的 Referer。 */
export interface HotlinkReferer {
    domain: string;
    referer: string;
}

/** 一个源在前端需要的事实。 */
export interface SourceFacts {
    id: string;
    title: string;
    hotlinkReferers: HotlinkReferer[];
}

/** 已接入的漫画源；就绪前为空数组（消费方排在 `whenSourcesReady()` 之后）。 */
export const SOURCES: SourceEntry[] = [];

/** 各源声明的热链对，按源顺序拍平（`imgSrc` 按 URL 子串匹配）。 */
const HOTLINK_REFERERS: HotlinkReferer[] = [];

/** 按源记的热链对（下载时取该源的 Referer）。 */
const BY_SOURCE = new Map<string, HotlinkReferer[]>();

/** 用源注册表填充清单与热链对；显示名优先取已装源的 `name`（源仓库可改名）。 */
export function applyBundledSources(
    bundled: SourceFacts[],
    installed: Record<string, { name: string }>,
): void {
    SOURCES.length = 0;
    HOTLINK_REFERERS.length = 0;
    BY_SOURCE.clear();
    for (const s of bundled) {
        SOURCES.push({ id: s.id, title: installed[s.id]?.name ?? s.title });
        BY_SOURCE.set(s.id, s.hotlinkReferers);
        HOTLINK_REFERERS.push(...s.hotlinkReferers);
    }
}

export function sourceTitle(id: string): string {
    return SOURCES.find((s) => s.id === id)?.title ?? id;
}

/** 图片 URL 命中的热链 Referer；没有声明则返回 null（前端直连加载）。 */
export function hotlinkRefererFor(url: string): string | null {
    for (const { domain, referer } of HOTLINK_REFERERS) {
        if (url.includes(domain)) return referer;
    }
    return null;
}

/** 某源声明的 Referer（下载图片时带上）；没有声明返回空串。 */
export function sourceReferer(id: string): string {
    return BY_SOURCE.get(id)?.[0]?.referer ?? "";
}
