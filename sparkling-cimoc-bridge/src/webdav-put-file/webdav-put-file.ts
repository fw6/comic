import pipe from 'com.tiktok.sparkling.methods.cimoc';
import type { WebdavPutFileRequest, WebdavPutFileResponse } from './webdavPutFile.d';

/**
 * webdavPutFile method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 * @throws Will call callback with error if base validation fails
 * @throws Will call callback with error if user validation fails
 * @throws Will call callback with error if password validation fails
 * @throws Will call callback with error if fileName validation fails
 * @throws Will call callback with error if content validation fails
 */
export function webdavPutFile(params: WebdavPutFileRequest, callback: (result: WebdavPutFileResponse) => void): void {
    // Parameter validation
    if (!params) {
        const errorResponse: WebdavPutFileResponse = {
            code: -1,
            msg: 'Invalid params: params cannot be null or undefined',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }

    // type-check validation for base
    if (!params.base || typeof params.base !== 'string' || !params.base.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: base must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }
    // type-check validation for user
    if (!params.user || typeof params.user !== 'string' || !params.user.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: user must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }
    // type-check validation for password
    if (!params.password || typeof params.password !== 'string' || !params.password.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: password must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }
    // type-check validation for fileName
    if (!params.fileName || typeof params.fileName !== 'string' || !params.fileName.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: fileName must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }
    // type-check validation for content
    if (!params.content || typeof params.content !== 'string' || !params.content.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: content must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }

    // Callback validation
    if (typeof callback !== 'function') {
        console.error('[cimoc] webdavPutFile: callback must be a function');
        return;
    }

    // Pipe call
    pipe.call('cimoc.webdavPutFile', {
        base: params.base.trim(),
        user: params.user.trim(),
        password: params.password.trim(),
        fileName: params.fileName.trim(),
        content: params.content.trim(),
    }, (v: unknown) => {
        // Type assertion and response normalization
        const response = v as WebdavPutFileResponse;
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