import { act, renderHook, waitFor } from '@testing-library/react-native';

/**
 * A helper class to facilitate testing of React Native hooks.
 * 
 * @class HookTester
 */
export class HookTester {
	/** @type {import('@testing-library/react-native').RenderHookResult} */
	hookRenderer;

	/**
	 * Creates an instance of HookTester.
	 * 
	 * @param {Function} hook - The hook function to test.
	 * @param {Array} props - Array of hook props to pass to the function as arguments.
	 */
	constructor(hook, props = []) {
		const config = {
			initialProps: props
		};

		this.hookRenderer = renderHook(
			props => hook(...props),
			config
		);
	};

	get currentResult() {
		return this.hookRenderer.result?.current;
	}

	/**
	 * Updates the props passed to the hook and re-renders it.
	 * 
	 * @param {Array} newProps - The new props to pass to the hook as arguments.
	 */
	updateProps = newProps => {
		this.hookRenderer.rerender(newProps);
	};

	/**
	 * Expects the current result of the hook to strictly equal the expected value.
	 * 
	 * @param {any} expected - The expected value to compare against the current result.
	 */
	expectResult = expected => {
		expect(this.currentResult).toStrictEqual(expected);
	};

	/**
	 * Advances timers by a specified time to simulate waiting.
	 * 
	 * @param {number} time - The time in milliseconds to advance timers by. Default is 2000ms.
	 */
	waitForTimer = async (time = 2000) => {
		await act(async () => {
			jest.advanceTimersByTime(time);
		});
	};

	/**
	 * Waits for the expected condition to be met.
	 * 
	 * @param {Function} callback - The callback function to wait for.
	 */
	waitFor = async callback => {
		await waitFor(callback);
	};
};
