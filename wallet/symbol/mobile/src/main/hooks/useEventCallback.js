import { useCallback, useRef } from 'react';

/**
 * React hook that keeps a callback identity stable across renders while always invoking its latest version.
 * Intended for callbacks handed to long-lived subscriptions, such as controller event listeners, which are
 * registered once. Without it, such a subscription keeps calling the callback of the render it was
 * registered in, and therefore acts on the state the screen was mounted with.
 * @param {function(...*): *} callback - The callback to keep up to date.
 * @returns {function(...*): *} The callback with a stable identity, invoking the latest version.
 */
export const useEventCallback = callback => {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	return useCallback((...args) => callbackRef.current(...args), []);
};
