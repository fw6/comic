// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface GetBytesRequest {
  url: string;
}

export interface GetBytesResponse {
  status: number;
  base64: string;
}

/**
 * getBytes method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 */
declare function getBytes(params: GetBytesRequest, callback: (result: GetBytesResponse) => void): void;