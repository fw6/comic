import pipe from 'com.tiktok.sparkling.methods.cimoc';
import type { GetTextRequest, GetTextResponse } from './getText.d';

/**
 * getText method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 * @throws Will call callback with error if url validation fails
 */
export function getText(params: GetTextRequest, callback: (result: GetTextResponse) => void): void {
    // Parameter validation
    if (!params) {
        const errorResponse: GetTextResponse = {
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

    // Callback validation
    if (typeof callback !== 'function') {
        console.error('[cimoc] getText: callback must be a function');
        return;
    }

    // Pipe call
    pipe.call('cimoc.getText', {
        url: params.url.trim(),
        headers: params.headers,
    }, (v: unknown) => {
        // Type assertion and response normalization
        const response = v as GetTextResponse;
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