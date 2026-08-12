// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Cimoc 原生桥方法声明（Sparkling Method）。
由 sparkling-method-cli codegen 读取，生成 Android&#x2F;iOS 原生桩。

说明：codegen 对 Map&#x2F;对象数组类型支持不完整（生成缺失的 Record 引用），
因此涉及 map&#x2F;对象数组的 4 个形状（headers &#x2F; chapters &#x2F; comics）使用
JSON 字符串传输，由 app 侧 bridge.ts 与原生实现负责编解码。
命名约定：函数名 &#x3D; 方法名，XxxRequest&#x2F;XxxResponse 接口 &#x3D; 参数&#x2F;结果模型。
 */
export interface ListKeysRequest {
}

export interface ListKeysResponse {
  keys: string[];
}

/**
 * listKeys method
 * @param callback - Callback function to handle the response
 */
declare function listKeys(callback: (result: ListKeysResponse) => void): void;