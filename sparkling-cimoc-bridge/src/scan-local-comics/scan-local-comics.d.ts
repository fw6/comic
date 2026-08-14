// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface ScanLocalComicsRequest {
}

export interface ScanLocalComicsResponse {
  /**
   * JSON 字符串编码的 Array&amp;lt;{comicId, chapterCount}&amp;gt;
   */
  comicsJson: string;
}

/**
 * scanLocalComics method
 * @param callback - Callback function to handle the response
 */
declare function scanLocalComics(callback: (result: ScanLocalComicsResponse) => void): void;