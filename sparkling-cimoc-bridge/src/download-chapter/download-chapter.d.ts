// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface DownloadChapterRequest {
  url: string;
  comicId: string;
  chapterIndex: number;
  pageIndex: number;
}

export interface DownloadChapterResponse {
  success: boolean;
}

/**
 * downloadChapter method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 */
declare function downloadChapter(params: DownloadChapterRequest, callback: (result: DownloadChapterResponse) => void): void;