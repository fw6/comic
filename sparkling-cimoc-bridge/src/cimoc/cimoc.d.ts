/**
 * Cimoc 原生桥方法声明（Sparkling Method）。
 * 由 sparkling-method-cli codegen 读取，生成 Android/iOS 原生桩。
 *
 * 说明：codegen 对 Map/对象数组类型支持不完整（生成缺失的 Record 引用），
 * 因此涉及 map/对象数组的 4 个形状（headers / chapters / comics）使用
 * JSON 字符串传输，由 app 侧 bridge.ts 与原生实现负责编解码。
 * 命名约定：函数名 = 方法名，XxxRequest/XxxResponse 接口 = 参数/结果模型。
 */

export interface EmptyParams {}

// ===== Network =====
export interface GetTextRequest {
  url: string;
  /** JSON 字符串编码的请求头 Map<string,string>（如 {"User-Agent":"..."}） */
  headers?: string;
}
export interface GetTextResponse {
  status: number;
  body: string;
}
declare function getText(params: GetTextRequest, callback: (result: GetTextResponse) => void): void;

// ===== Download =====
export interface DownloadChapterRequest {
  url: string;
  comicId: string;
  chapterIndex: number;
  pageIndex: number;
}
export interface DownloadChapterResponse {
  success: boolean;
}
declare function downloadChapter(params: DownloadChapterRequest, callback: (result: DownloadChapterResponse) => void): void;

export interface ListDownloadedRequest {
  comicId: string;
}
export interface ListDownloadedResponse {
  /** JSON 字符串编码的 Map<chapterIndex, string[]> */
  chaptersJson: string;
}
declare function listDownloadedChapters(params: ListDownloadedRequest, callback: (result: ListDownloadedResponse) => void): void;

// ===== Local =====
export interface ScanLocalComicsResponse {
  /** JSON 字符串编码的 Array<{comicId, chapterCount}> */
  comicsJson: string;
}
declare function scanLocalComics(params: EmptyParams, callback: (result: ScanLocalComicsResponse) => void): void;

export interface PickFolderResponse {
  success: boolean;
}
declare function pickFolder(params: EmptyParams, callback: (result: PickFolderResponse) => void): void;

// ===== WebDAV =====
export interface WebDavPutRequest {
  base: string;
  user: string;
  password: string;
  fileName: string;
  content: string;
}
export interface WebDavPutResponse {
  success: boolean;
  status: number;
}
declare function webdavPutFile(params: WebDavPutRequest, callback: (result: WebDavPutResponse) => void): void;

export interface WebDavGetRequest {
  base: string;
  user: string;
  password: string;
  fileName: string;
}
export interface WebDavGetResponse {
  ok: boolean;
  content?: string;
  status?: number;
  error?: string;
}
declare function webdavGetFile(params: WebDavGetRequest, callback: (result: WebDavGetResponse) => void): void;

// ===== Rust 核心 =====
export interface RustVersionResponse {
  version: string;
}
declare function rustVersion(params: EmptyParams, callback: (result: RustVersionResponse) => void): void;
