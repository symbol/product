import { useCallback, useRef } from 'react';

/**
 * Debounce hook with immediate first call.
 * @param {function(...*): void} callback - Function to debounce.
 * @param {number} delay - Delay in ms.
 * @returns {function(...any): void} - Debounced function.
 */
export const useDebounce = (callback, delay) => {
	const timerRef = useRef(null);
	const lastCallTimeRef = useRef(0);
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	const call = useCallback(
		(...args) => {
			const now = Date.now();

			if (now - lastCallTimeRef.current >= delay) {
				lastCallTimeRef.current = now;
				callbackRef.current(...args);
			} else {
				if (timerRef.current) 
					clearTimeout(timerRef.current);

				const remaining = delay - (now - lastCallTimeRef.current);

				timerRef.current = setTimeout(() => {
					lastCallTimeRef.current = Date.now();
					callbackRef.current(...args);
				}, remaining);
			}
		},
		[delay]
	);

	return call;
};
