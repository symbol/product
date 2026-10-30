import { useState } from 'react';

/** @typedef {import('@/app/types/RefreshController').RefreshController} RefreshController */

/**
 * Creates a refresh controller. Used to trigger refresh events on child components.
 * @returns {RefreshController} The refresh controller.
 */
const createRefreshController = () => {
	const listeners = new Set();

	const subscribe = listener => {
		listeners.add(listener);

		return () => {
			listeners.delete(listener);
		};
	};
	const refresh = async () => {
		await Promise.allSettled([...listeners].map(listener => listener()));
	};

	return { subscribe, refresh };
};

/**
 * React hook that creates refresh controller. Used on screen to trigger widgets to reload their data.
 * @returns {RefreshController} The screen refresh controller.
 */
export const useRefreshController = () => {
	const [refreshController] = useState(createRefreshController);

	return refreshController;
};
