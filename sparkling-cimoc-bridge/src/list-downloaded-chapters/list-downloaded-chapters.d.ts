// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface ListDownloadedChaptersRequest {
  comicId: string;
}

export interface ListDownloadedChaptersResponse {
  /**
   * JSON 字符串编码的 Map&amp;lt;chapterIndex, string[]&amp;gt;
   */
  chaptersJson: string;
}

/**
 * listDownloadedChapters method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 */
declare function listDownloadedChapters(params: ListDownloadedChaptersRequest, callback: (result: ListDownloadedChaptersResponse) => void): void;