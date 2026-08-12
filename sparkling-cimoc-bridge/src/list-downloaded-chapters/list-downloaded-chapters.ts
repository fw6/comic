import pipe from 'com.tiktok.sparkling.methods.cimoc';
import type { ListDownloadedChaptersRequest, ListDownloadedChaptersResponse } from './listDownloadedChapters.d';

/**
 * listDownloadedChapters method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 * @throws Will call callback with error if comicId validation fails
 */
export function listDownloadedChapters(params: ListDownloadedChaptersRequest, callback: (result: ListDownloadedChaptersResponse) => void): void {
    // Parameter validation
    if (!params) {
        const errorResponse: ListDownloadedChaptersResponse = {
            code: -1,
            msg: 'Invalid params: params cannot be null or undefined',
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

    // Callback validation
    if (typeof callback !== 'function') {
        console.error('[cimoc] listDownloadedChapters: callback must be a function');
        return;
    }

    // Pipe call
    pipe.call('cimoc.listDownloadedChapters', {
        comicId: params.comicId.trim(),
    }, (v: unknown) => {
        // Type assertion and response normalization
        const response = v as ListDownloadedChaptersResponse;
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