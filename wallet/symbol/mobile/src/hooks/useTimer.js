import { useEffect, useRef } from 'react';

/**
 * A custom hook that executes a function at a specific interval.
 * Reruns the timer with the updated function if dependencies change.
 *
 * @param {object} params - The parameters object.
 * @param {Function} params.callback - The function to be executed.
 * @param {number} params.interval - The interval in milliseconds.
 * @param {boolean} params.isActive - Whether the timer is active.
 * @param {Array} params.dependencies - The dependencies that trigger the timer to restart.
 */
export const useTimer = ({ callback, interval, isActive, dependencies = [] }) => {
	const savedCallback = useRef(callback);

	useEffect(() => {
		savedCallback.current = callback;
	}, [callback]);

	useEffect(() => {
		if (!isActive || interval === null || interval === undefined) 
			return;		

		const tick = () => {
			savedCallback.current();
		};

		const id = setInterval(tick, interval);

		return () => clearInterval(id);
	}, [interval, isActive, ...dependencies]);
};
