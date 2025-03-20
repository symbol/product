import { useEffect } from 'react';

/**
 * A custom React hook that runs a callback function when the `isReady` state is `true`.
 * The callback is also re-triggered when any dependencies in `deps` change, but only if `isReady` is `true`.
 *
 * @param {() => void} callback - The function to execute when `isReady` becomes `true`.
 * @param {boolean} isReady - A boolean flag that determines whether the callback should run.
 * @param {any[]} [deps=[]] - An optional array of dependencies that trigger re-execution when they change.
 */
export const useInit = (callback, isReady, deps = []) => {
    useEffect(() => {
        if (isReady) {
            callback();
        }
    }, [isReady, ...deps]);
};
