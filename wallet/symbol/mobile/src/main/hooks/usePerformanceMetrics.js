import { useEffect, useRef } from 'react';

export const usePerformanceMetrics = (name = '') => {
	const start = useRef(performance.now());

	useEffect(() => {
		const end = performance.now();
		// eslint-disable-next-line no-console
		console.log(`[${name}] render time:`, (end - start.current).toFixed(2), 'ms');
	}, []);
};
