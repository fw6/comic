/** 已接入的漫画源（与 mojuan-core 的源脚本 id 对应）。 */
export interface SourceEntry {
    id: string;
    title: string;
}

export const SOURCES: SourceEntry[] = [
    { id: "mangadex", title: "MangaDex" },
    { id: "webtoons", title: "Webtoons" },
    { id: "copymanga", title: "Copymanga" },
    { id: "dongman", title: "咚漫" },
    { id: "manhuagui", title: "漫画柜" },
    { id: "baozimh", title: "包子漫画" },
    { id: "nnhanman", title: "鸟鸟韩漫" },
    { id: "kxmanhua", title: "开心看漫画" },
    { id: "hentara", title: "Hentara" },
];

export function sourceTitle(id: string): string {
    return SOURCES.find((s) => s.id === id)?.title ?? id;
}
