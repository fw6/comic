import pipe from 'com.tiktok.sparkling.methods.cimoc';
import type { ScanLocalComicsRequest, ScanLocalComicsResponse } from './scanLocalComics.d';

/**
 * scanLocalComics method
 * @param callback - Callback function to handle the response
 */
export function scanLocalComics(callback: (result: ScanLocalComicsResponse) => void): void {
    // Parameter validation
    if (!params) {
        const errorResponse: ScanLocalComicsResponse = {
            code: -1,
            msg: 'Invalid params: params cannot be null or undefined',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }


    // Callback validation
    if (typeof callback !== 'function') {
        console.error('[cimoc] scanLocalComics: callback must be a function');
        return;
    }

    // Pipe call
    pipe.call('cimoc.scanLocalComics', {
    }, (v: unknown) => {
        // Type assertion and response normalization
        const response = v as ScanLocalComicsResponse;
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