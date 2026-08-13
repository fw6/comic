// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface SetBackStateRequest {
  /** JS 导航栈是否可返回（栈深 > 1） */
  canGoBack: boolean;
}

export interface SetBackStateResponse {
  success: boolean;
}

/**
 * setBackState method
 * 上报 JS 导航栈可返回状态给原生宿主；宿主据此决定系统返回手势是弹栈还是退出。
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 */
declare function setBackState(
  params: SetBackStateRequest,
  callback: (result: SetBackStateResponse) => void,
): void;
