// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface CrawlRequest {
    /**
     * 操作：categories | search | category | detail | images | cache_dump | cache_hydrate
     */
    op: string;
    /**
     * 图源 id：mangadex | webtoons
     */
    sourceId: string;
    /**
     * JSON 字符串编码的参数对象（各 op 字段不同，见 crawler&amp;#x2F;mod.rs 协议）
     */
    payload: string;
}

export interface CrawlResponse {
    /**
     * JSON 字符串编码的结果（列表 &amp;#x2F; 对象 &amp;#x2F; 数组），失败返回空 JSON
     */
    json: string;
}

/**
 * crawl method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 */
declare function crawl(
    params: CrawlRequest,
    callback: (result: CrawlResponse) => void,
): void;
