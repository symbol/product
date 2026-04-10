import { useCallback, useEffect, useState } from 'react';

/**
 * Hook to manage refresh state and provide a refresh function that can be called to trigger a refresh.
 * Expects a callback that performs the refresh/load action and an isLoading boolean to track its loading state.
 * Separates the refreshing state from the loading state to allow for better control over when to show loading indicators.
 * 
 * @param {() => void} callback - Callback function to perform the refresh action.
 * @param {boolean} isLoading - Boolean indicating whether the refresh action is currently loading.
 * @returns {Object} - An object containing the refresh function and a boolean indicating if it's currently refreshing.
 */
export const useRefresh = (callback, isLoading) => {
	const [isRefreshing, setIsRefreshing] = useState(false);

	const refresh = useCallback(() => {
		setIsRefreshing(true);
		callback();
	}, [callback]);

	useEffect(() => {
		if (!isLoading && isRefreshing)
			setIsRefreshing(false);
        
	}, [isLoading, isRefreshing]);

	return { refresh, isRefreshing };
};

