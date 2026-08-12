import pipe from 'com.tiktok.sparkling.methods.cimoc';
import type { DownloadChapterRequest, DownloadChapterResponse } from './downloadChapter.d';

/**
 * downloadChapter method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 * @throws Will call callback with error if url validation fails
 * @throws Will call callback with error if comicId validation fails
 * @throws Will call callback with error if chapterIndex validation fails
 * @throws Will call callback with error if pageIndex validation fails
 */
export function downloadChapter(params: DownloadChapterRequest, callback: (result: DownloadChapterResponse) => void): void {
    // Parameter validation
    if (!params) {
        const errorResponse: DownloadChapterResponse = {
            code: -1,
            msg: 'Invalid params: params cannot be null or undefined',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }

    // type-check validation for url
    if (!params.url || typeof params.url !== 'string' || !params.url.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: url must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }
    // type-check validation for comicId
    if (!params.comicId || typeof params.comicId !== 'string' || !params.comicId.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: comicId must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }
    // type-check validation for chapterIndex
    if (!params.chapterIndex || typeof params.chapterIndex !== 'number') {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: chapterIndex must be of type number',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }
    // type-check validation for pageIndex
    if (!params.pageIndex || typeof params.pageIndex !== 'number') {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: pageIndex must be of type number',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }

    // Callback validation
    if (typeof callback !== 'function') {
        console.error('[cimoc] downloadChapter: callback must be a function');
        return;
    }

    // Pipe call
    pipe.call('cimoc.downloadChapter', {
        url: params.url.trim(),
        comicId: params.comicId.trim(),
        chapterIndex: params.chapterIndex,
        pageIndex: params.pageIndex,
    }, (v: unknown) => {
        // Type assertion and response normalization
        const response = v as DownloadChapterResponse;
        const code = response?.code ?? -1;
        // Pipe status codes: 1 = succeeded, 0 = failed, negative = various errors.
        // When the native side reports success it may omit `msg`, so fall back to
        // 'ok' instead of the misleading 'Unknown error'.
        const isSuccess = code === 1;
        const msg = response?.msg ?? (isSuccess ? 'ok' : 'Unknown error');
        callback({
            code,
            msg,
        });
    });
}