import { useEffect, useState } from 'react';

/**
 * A custom hook for managing loading states. Separates the initial loading state from subsequent loading states, that is counted as refreshing.
 *
 * @param {boolean} isLoading - Indicates whether data is currently being loaded.
 * @param {boolean} [initialLoadingState=false] - The initial state of the loading indicator.
 * @returns {[boolean, boolean]} - Returns an array containing:
 *   - `isInitialLoading`: `true` if loading for the first time, otherwise `false`.
 *   - `isRefreshing`: `true` if a subsequent loading process is happening, otherwise `false`.
 */
export const useLoading = (isLoading, initialLoadingState = false) => {
    const [isLoadedOnce, setIsLoadedOnce] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(initialLoadingState);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (isLoading && !isLoadedOnce) {
            setIsInitialLoading(true);
            setIsLoadedOnce(true);
        }

        if (isLoading && isLoadedOnce && !isInitialLoading) {
            setIsRefreshing(true);
        }

        if (!isLoading) {
            setIsInitialLoading(false);
            setIsRefreshing(false);
        }
    }, [isLoadedOnce, isLoading, isInitialLoading]);

    return [isInitialLoading, isRefreshing];
};
