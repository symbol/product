import { useState } from 'react';

/**
 * @typedef {Object} SuccessResult
 * @property {'fulfilled'} status - Status.
 * @property {any} value - Resolved value.
 */

/**
 * @typedef {Object} ErrorResult
 * @property {'rejected'} status - Status.
 * @property {Error | any} reason - Caught error.
 */

/**
 * @typedef {Object<string, SuccessResult | ErrorResult>} PromiseResultMap
 */

/**
 * @typedef {Object<string, Promise} PromiseRequestMap
 */

/**
 * Handles promises and their statuses. Wrapper for Promise.allSettled().
 * Promises should be provided as a map with keys.
 * Results are stored in a map with the specified key.
 *
 * @returns {[PromiseResultMap, (promiseMap: PromiseRequestMap) => void]} - Promise result map and runPromises function.
 */
export const usePromiseMap = () => {
    const [promiseMap, setPromiseMap] = useState({});

    const handleFulfilled = (key, value) => {
        setPromiseMap((prev) => ({
            ...prev,
            [key]: {
                status: 'fulfilled',
                value,
            },
        }));
    };
    const handleRejected = (key, reason) => {
        setPromiseMap((prev) => ({
            ...prev,
            [key]: {
                status: 'rejected',
                reason,
            },
        }));
    };

    const runPromises = (promiseMapRequest) => {
        setPromiseMap({});
        Promise.all(
            Object.entries(promiseMapRequest).map(([key, promise]) =>
                promise.then((value) => handleFulfilled(key, value)).catch((reason) => handleRejected(key, reason))
            )
        );
    };

    return [promiseMap, runPromises];
};
