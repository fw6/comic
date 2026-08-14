/**
 * Cimoc 原生桥方法包（Sparkling Method）JS 侧入口。
 *
 * codegen 生成的逐方法 TS 实现不完整（丢弃原生 data、类型残缺），因此这里手写统一门面：
 * 每个函数按官方方法包 pattern 走 `pipe.call('cimoc.<name>', params, cb)`，
 * 并把原生 `{code, msg, data}` 中的 data 透传给回调。
 *
 * 参数/结果接口复用 codegen 生成的类型定义（src/<name>/<name>.d.ts）。
 */
import pipe from 'sparkling-method';
import type { PipeResponse } from 'sparkling-method';

import type { DownloadChapterRequest, DownloadChapterResponse } from './src/download-chapter/download-chapter.d';
import type { ListDownloadedChaptersRequest, ListDownloadedChaptersResponse } from './src/list-downloaded-chapters/list-downloaded-chapters.d';
import type { ScanLocalComicsRequest, ScanLocalComicsResponse } from './src/scan-local-comics/scan-local-comics.d';
import type { PickFolderRequest, PickFolderResponse } from './src/pick-folder/pick-folder.d';
import type { WebdavPutFileRequest, WebdavPutFileResponse } from './src/webdav-put-file/webdav-put-file.d';
import type { WebdavGetFileRequest, WebdavGetFileResponse } from './src/webdav-get-file/webdav-get-file.d';
import type { RustVersionRequest, RustVersionResponse } from './src/rust-version/rust-version.d';
import type { CrawlRequest, CrawlResponse } from './src/crawl/crawl.d';

export type {
  DownloadChapterRequest,
  DownloadChapterResponse,
  ListDownloadedChaptersRequest,
  ListDownloadedChaptersResponse,
  ScanLocalComicsRequest,
  ScanLocalComicsResponse,
  PickFolderRequest,
  PickFolderResponse,
  WebdavPutFileRequest,
  WebdavPutFileResponse,
  WebdavGetFileRequest,
  WebdavGetFileResponse,
  RustVersionRequest,
  RustVersionResponse,
  CrawlRequest,
  CrawlResponse,
};

export type PipeResult<T> = {
  code: number;
  msg: string;
  data?: T;
};

type Callback<T> = (result: PipeResult<T>) => void;

function callMethod<T>(method: string, params: unknown, callback: Callback<T>): void {
  if (typeof callback !== 'function') {
    console.error(`[cimoc] ${method}: callback must be a function`);
    return;
  }
  pipe.call(method, params, (v: unknown) => {
    const raw = (v ?? {}) as PipeResponse<T>;
    // Pipe 状态码：1 成功，0 失败，负数各类错误；成功时原生可能省略 msg。
    const isSuccess = raw.code === 1;
    callback({ code: raw.code, msg: raw.msg ?? (isSuccess ? 'ok' : 'Unknown error'), data: raw.data });
  });
}

function requireParams<T extends object, U>(
  method: string,
  params: T | undefined,
  callback: Callback<U>,
): T | null {
  if (!params || typeof params !== 'object') {
    callback({ code: -1, msg: `Invalid params: ${method} requires a params object` });
    return null;
  }
  return params;
}

// --- Download ---
export function downloadChapter(params: DownloadChapterRequest, callback: Callback<DownloadChapterResponse>): void {
  const p = requireParams('downloadChapter', params, callback);
  if (p) callMethod('cimoc.downloadChapter', p, callback);
}
export function listDownloadedChapters(
  params: ListDownloadedChaptersRequest,
  callback: Callback<ListDownloadedChaptersResponse>,
): void {
  const p = requireParams('listDownloadedChapters', params, callback);
  if (p) callMethod('cimoc.listDownloadedChapters', p, callback);
}

// --- Local ---
export function scanLocalComics(callback: Callback<ScanLocalComicsResponse>): void {
  callMethod('cimoc.scanLocalComics', {}, callback);
}
export function pickFolder(callback: Callback<PickFolderResponse>): void {
  callMethod('cimoc.pickFolder', {}, callback);
}

// --- WebDAV ---
export function webdavPutFile(params: WebdavPutFileRequest, callback: Callback<WebdavPutFileResponse>): void {
  const p = requireParams('webdavPutFile', params, callback);
  if (p) callMethod('cimoc.webdavPutFile', p, callback);
}
export function webdavGetFile(params: WebdavGetFileRequest, callback: Callback<WebdavGetFileResponse>): void {
  const p = requireParams('webdavGetFile', params, callback);
  if (p) callMethod('cimoc.webdavGetFile', p, callback);
}

// --- Rust 核心 ---
export function rustVersion(callback: Callback<RustVersionResponse>): void {
  callMethod('cimoc.rustVersion', {}, callback);
}
export function crawl(params: CrawlRequest, callback: Callback<CrawlResponse>): void {
  const p = requireParams('crawl', params, callback);
  if (p) callMethod('cimoc.crawl', p, callback);
}