import { useEffect, useRef } from 'react';

/**
 * A custom hook that executes a function at a specific interval.
 * Reruns the timer with the updated function if dependencies change.
 * @param {object} params - The parameters object.
 * @param {function(): void} params.callback - The function to be executed.
 * @param {number} params.interval - The interval in milliseconds.
 * @param {boolean} params.isActive - Whether the timer is active.
 * @param {boolean} params.hasImmediateExecution - Whether the timer should execute immediately.
 * @param {Array} params.dependencies - The dependencies that trigger the timer to restart.
 */
export const useTimer = ({ callback, interval, isActive, hasImmediateExecution = false, dependencies = [] }) => {
	const savedCallback = useRef(callback);

	useEffect(() => {
		savedCallback.current = callback;
	}, [callback]);

	useEffect(() => {
		if (!isActive) 
			return;	
		
		if (!interval || interval <= 0)
			throw new Error('Interval must be a positive number');

		const tick = () => {
			savedCallback.current();
		};

		if (hasImmediateExecution)
			tick();
		
		const id = setInterval(tick, interval);

		return () => clearInterval(id);
	}, [interval, isActive, hasImmediateExecution, ...dependencies]);
};
