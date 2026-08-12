// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface ListLocalChaptersRequest {
  comicId: string;
}

export interface ListLocalChaptersResponse {
  /**
   * JSON 字符串编码的 Array&lt;{chapterIndex, pageCount, dir}&gt;
   */
  chaptersJson: string;
}

/**
 * listLocalChapters method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 */
declare function listLocalChapters(params: ListLocalChaptersRequest, callback: (result: ListLocalChaptersResponse) => void): void;