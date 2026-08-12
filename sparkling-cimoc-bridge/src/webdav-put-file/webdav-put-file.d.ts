// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface WebdavPutFileRequest {
  base: string;
  user: string;
  password: string;
  fileName: string;
  content: string;
}

export interface WebdavPutFileResponse {
  success: boolean;
  status: number;
}

/**
 * webdavPutFile method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 */
declare function webdavPutFile(params: WebdavPutFileRequest, callback: (result: WebdavPutFileResponse) => void): void;