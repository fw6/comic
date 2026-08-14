import pipe from 'com.tiktok.sparkling.methods.cimoc';
import type { CrawlRequest, CrawlResponse } from './crawl.d';

/**
 * crawl method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 * @throws Will call callback with error if op validation fails
 * @throws Will call callback with error if sourceId validation fails
 * @throws Will call callback with error if payload validation fails
 */
export function crawl(params: CrawlRequest, callback: (result: CrawlResponse) => void): void {
    // Parameter validation
    if (!params) {
        const errorResponse: CrawlResponse = {
            code: -1,
            msg: 'Invalid params: params cannot be null or undefined',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }

    // type-check validation for op
    if (!params.op || typeof params.op !== 'string' || !params.op.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: op must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }
    // type-check validation for sourceId
    if (!params.sourceId || typeof params.sourceId !== 'string' || !params.sourceId.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: sourceId must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }
    // type-check validation for payload
    if (!params.payload || typeof params.payload !== 'string' || !params.payload.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: payload must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }

    // Callback validation
    if (typeof callback !== 'function') {
        console.error('[cimoc] crawl: callback must be a function');
        return;
    }

    // Pipe call
    pipe.call('cimoc.crawl', {
        op: params.op.trim(),
        sourceId: params.sourceId.trim(),
        payload: params.payload.trim(),
    }, (v: unknown) => {
        // Type assertion and response normalization
        const response = v as CrawlResponse;
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