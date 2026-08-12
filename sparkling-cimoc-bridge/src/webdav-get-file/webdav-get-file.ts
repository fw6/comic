import pipe from 'com.tiktok.sparkling.methods.cimoc';
import type { WebdavGetFileRequest, WebdavGetFileResponse } from './webdavGetFile.d';

/**
 * webdavGetFile method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 * @throws Will call callback with error if base validation fails
 * @throws Will call callback with error if user validation fails
 * @throws Will call callback with error if password validation fails
 * @throws Will call callback with error if fileName validation fails
 */
export function webdavGetFile(params: WebdavGetFileRequest, callback: (result: WebdavGetFileResponse) => void): void {
    // Parameter validation
    if (!params) {
        const errorResponse: WebdavGetFileResponse = {
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

    // Callback validation
    if (typeof callback !== 'function') {
        console.error('[cimoc] webdavGetFile: callback must be a function');
        return;
    }

    // Pipe call
    pipe.call('cimoc.webdavGetFile', {
        base: params.base.trim(),
        user: params.user.trim(),
        password: params.password.trim(),
        fileName: params.fileName.trim(),
    }, (v: unknown) => {
        // Type assertion and response normalization
        const response = v as WebdavGetFileResponse;
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