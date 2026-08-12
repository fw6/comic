// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface GetTextRequest {
  url: string;
  /**
   * JSON 字符串编码的请求头 Map&lt;string,string&gt;（如 {&quot;User-Agent&quot;:&quot;...&quot;}）
   */
  headers?: string;
}

export interface GetTextResponse {
  status: number;
  body: string;
}

/**
 * getText method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 */
declare function getText(params: GetTextRequest, callback: (result: GetTextResponse) => void): void;