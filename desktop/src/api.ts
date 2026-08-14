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
    downloaded: boolean;
    read: boolean;
}

/** 调 Rust crawl 命令：payload 编码为 JSON 字符串，返回解析后的 JSON。 */
export function crawl<T>(op: string, source: string, payload: unknown): Promise<T> {
    return invoke<string>("crawl", { op, source, payload: JSON.stringify(payload) }).then(
        (json) => JSON.parse(json) as T,
    );
}

export const cimocVersion = () => invoke<string>("cimoc_version");

/** 热链保护域（research #4 结论）：重写为 cimoc-img:// 代理，其余保持直连吃 webview 缓存。 */
export function imgSrc(url: string): string {
    if (url.includes("pstatic.net")) {
        return `cimoc-img://localhost/img?url=${encodeURIComponent(url)}&ref=${encodeURIComponent("https://www.webtoons.com/")}`;
    }
    return url;
}
