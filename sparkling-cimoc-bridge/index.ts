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

import type { GetTextRequest, GetTextResponse } from './src/get-text/get-text.d';
import type { GetBytesRequest, GetBytesResponse } from './src/get-bytes/get-bytes.d';
import type { IsNetworkAvailableRequest, IsNetworkAvailableResponse } from './src/is-network-available/is-network-available.d';
import type { SetValueRequest, SetValueResponse } from './src/set-value/set-value.d';
import type { GetValueRequest, GetValueResponse } from './src/get-value/get-value.d';
import type { RemoveValueRequest, RemoveValueResponse } from './src/remove-value/remove-value.d';
import type { ListKeysRequest, ListKeysResponse } from './src/list-keys/list-keys.d';
import type { DownloadChapterRequest, DownloadChapterResponse } from './src/download-chapter/download-chapter.d';
import type { ListDownloadedChaptersRequest, ListDownloadedChaptersResponse } from './src/list-downloaded-chapters/list-downloaded-chapters.d';
import type { DeleteComicDownloadRequest, DeleteComicDownloadResponse } from './src/delete-comic-download/delete-comic-download.d';
import type { GetDownloadDirRequest, GetDownloadDirResponse } from './src/get-download-dir/get-download-dir.d';
import type { ScanLocalComicsRequest, ScanLocalComicsResponse } from './src/scan-local-comics/scan-local-comics.d';
import type { ListLocalChaptersRequest, ListLocalChaptersResponse } from './src/list-local-chapters/list-local-chapters.d';
import type { PickFolderRequest, PickFolderResponse } from './src/pick-folder/pick-folder.d';
import type { WebdavPutFileRequest, WebdavPutFileResponse } from './src/webdav-put-file/webdav-put-file.d';
import type { WebdavGetFileRequest, WebdavGetFileResponse } from './src/webdav-get-file/webdav-get-file.d';

export type {
  GetTextRequest,
  GetTextResponse,
  GetBytesRequest,
  GetBytesResponse,
  IsNetworkAvailableRequest,
  IsNetworkAvailableResponse,
  SetValueRequest,
  SetValueResponse,
  GetValueRequest,
  GetValueResponse,
  RemoveValueRequest,
  RemoveValueResponse,
  ListKeysRequest,
  ListKeysResponse,
  DownloadChapterRequest,
  DownloadChapterResponse,
  ListDownloadedChaptersRequest,
  ListDownloadedChaptersResponse,
  DeleteComicDownloadRequest,
  DeleteComicDownloadResponse,
  GetDownloadDirRequest,
  GetDownloadDirResponse,
  ScanLocalComicsRequest,
  ScanLocalComicsResponse,
  ListLocalChaptersRequest,
  ListLocalChaptersResponse,
  PickFolderRequest,
  PickFolderResponse,
  WebdavPutFileRequest,
  WebdavPutFileResponse,
  WebdavGetFileRequest,
  WebdavGetFileResponse,
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

// --- Network ---
export function getText(params: GetTextRequest, callback: Callback<GetTextResponse>): void {
  const p = requireParams('getText', params, callback);
  if (p) callMethod('cimoc.getText', p, callback);
}
export function getBytes(params: GetBytesRequest, callback: Callback<GetBytesResponse>): void {
  const p = requireParams('getBytes', params, callback);
  if (p) callMethod('cimoc.getBytes', p, callback);
}
export function isNetworkAvailable(callback: Callback<IsNetworkAvailableResponse>): void {
  callMethod('cimoc.isNetworkAvailable', {}, callback);
}

// --- Storage ---
export function setValue(params: SetValueRequest, callback: Callback<SetValueResponse>): void {
  const p = requireParams('setValue', params, callback);
  if (p) callMethod('cimoc.setValue', p, callback);
}
export function getValue(params: GetValueRequest, callback: Callback<GetValueResponse>): void {
  const p = requireParams('getValue', params, callback);
  if (p) callMethod('cimoc.getValue', p, callback);
}
export function removeValue(params: RemoveValueRequest, callback: Callback<RemoveValueResponse>): void {
  const p = requireParams('removeValue', params, callback);
  if (p) callMethod('cimoc.removeValue', p, callback);
}
export function listKeys(callback: Callback<ListKeysResponse>): void {
  callMethod('cimoc.listKeys', {}, callback);
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
export function deleteComicDownload(params: DeleteComicDownloadRequest, callback: Callback<DeleteComicDownloadResponse>): void {
  const p = requireParams('deleteComicDownload', params, callback);
  if (p) callMethod('cimoc.deleteComicDownload', p, callback);
}
export function getDownloadDir(callback: Callback<GetDownloadDirResponse>): void {
  callMethod('cimoc.getDownloadDir', {}, callback);
}

// --- Local ---
export function scanLocalComics(callback: Callback<ScanLocalComicsResponse>): void {
  callMethod('cimoc.scanLocalComics', {}, callback);
}
export function listLocalChapters(params: ListLocalChaptersRequest, callback: Callback<ListLocalChaptersResponse>): void {
  const p = requireParams('listLocalChapters', params, callback);
  if (p) callMethod('cimoc.listLocalChapters', p, callback);
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
