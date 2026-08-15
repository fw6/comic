import { invoke } from "@tauri-apps/api/core";

export interface Comic {
    id: string;
    source: string;
    sourceTitle: string;
    title: string;
    author: string;
    intro: string;
    cover: string;
    status: string;
    updateTime: string;
    lastChapter: string;
    tags: string[];
    lastReadChapter: number;
    lastReadTime: number;
}

export interface Chapter {
    index: number;
    title: string;
    pages: string[];
    /** 外链章节（内容托管站外，如 MangaPlus）：列表与「下一话」一律过滤（grilling #6） */
    external: boolean;
    downloaded: boolean;
    read: boolean;
}

/** 本地扫描/下载目录里的漫画条目。 */
export interface LocalComic {
    comicId: string;
    chapterCount: number;
}

/** 调 Rust crawl 命令：payload 编码为 JSON 字符串，返回解析后的 JSON。 */
export function crawl<T>(op: string, source: string, payload: unknown): Promise<T> {
    return invoke<string>("crawl", { op, source, payload: JSON.stringify(payload) }).then(
        (json) => JSON.parse(json) as T,
    );
}

export const cimocVersion = () => invoke<string>("cimoc_version");

/** 扫描下载目录/本地文件夹：`[{comicId, chapterCount}]`。 */
export const scanLocal = (dir: string) =>
    invoke<string>("scan_local", { dir }).then(
        (json) => JSON.parse(json) as LocalComic[],
    );

/** 某漫画已下载章节：`{chapterIndex: [文件路径]}`。 */
export const listDownloaded = (dir: string, comicId: string) =>
    invoke<string>("list_downloaded", { dir, comicId }).then(
        (json) => JSON.parse(json) as Record<string, string[]>,
    );

/** 下载单页到下载目录，返回是否成功。referer 非空时带上（热链域如 pstatic.net 需要）。 */
export const downloadImage = (
    url: string,
    dir: string,
    comicId: string,
    chapterIndex: number,
    pageIndex: number,
    referer: string,
) =>
    invoke<string>("download_image", {
        url,
        dir,
        comicId,
        chapterIndex,
        pageIndex,
        referer,
    }).then((v) => v === "true");

/** 热链保护域（research #4 结论）：重写为 cimoc-img:// 代理，其余保持直连吃 webview 缓存。 */
export function imgSrc(url: string): string {
    if (url.includes("pstatic.net")) {
        return `cimoc-img://localhost/img?url=${encodeURIComponent(url)}&ref=${encodeURIComponent("https://www.webtoons.com/")}`;
    }
    return url;
}
