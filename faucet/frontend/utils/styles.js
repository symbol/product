/**
 * Returns breakpoint depending on screen size
 * @param {number} width - screen width
 * @param {number} height - screen height
 * @param {array} breakpoints - breakpoints configuration
 * @returns {{ width: number, height: width, portrait: boolean, className: string}} breakpoint object
 */
export const getBreakpoint = (width, height, breakpoints) => {
	let currentBreakpoint = breakpoints[0];

	for (let i = breakpoints.length - 1; 0 <= i; --i) {
		const breakpoint = breakpoints[i];

		if (breakpoint.width <= width && breakpoint.height <= height) {
			currentBreakpoint = breakpoint;
			break;
		}
	}

	return currentBreakpoint;
};
