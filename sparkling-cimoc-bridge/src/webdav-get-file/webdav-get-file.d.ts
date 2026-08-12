// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface WebdavGetFileRequest {
  base: string;
  user: string;
  password: string;
  fileName: string;
}

export interface WebdavGetFileResponse {
  ok: boolean;
  content?: string;
  status?: number;
  error?: string;
}

/**
 * webdavGetFile method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 */
declare function webdavGetFile(params: WebdavGetFileRequest, callback: (result: WebdavGetFileResponse) => void): void;