import pipe from 'com.tiktok.sparkling.methods.cimoc';
import type { SetValueRequest, SetValueResponse } from './setValue.d';

/**
 * setValue method
 * @param params - The request parameters
 * @param callback - Callback function to handle the response
 * @throws Will call callback with error if key validation fails
 * @throws Will call callback with error if value validation fails
 */
export function setValue(params: SetValueRequest, callback: (result: SetValueResponse) => void): void {
    // Parameter validation
    if (!params) {
        const errorResponse: SetValueResponse = {
            code: -1,
            msg: 'Invalid params: params cannot be null or undefined',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }

    // type-check validation for key
    if (!params.key || typeof params.key !== 'string' || !params.key.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: key must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }
    // type-check validation for value
    if (!params.value || typeof params.value !== 'string' || !params.value.trim()) {
        const errorResponse:  = {
            code: -1,
            msg: 'Invalid params: value must be a non-empty string',
        };
        if (typeof callback === 'function') {
            callback(errorResponse);
        }
        return;
    }

    // Callback validation
    if (typeof callback !== 'function') {
        console.error('[cimoc] setValue: callback must be a function');
        return;
    }

    // Pipe call
    pipe.call('cimoc.setValue', {
        key: params.key.trim(),
        value: params.value.trim(),
    }, (v: unknown) => {
        // Type assertion and response normalization
        const response = v as SetValueResponse;
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