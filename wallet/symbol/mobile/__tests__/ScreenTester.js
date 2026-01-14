import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

/**
 * A helper class to facilitate testing of React Native screens.
 * 
 * @class ScreenTester
 */
export class ScreenTester {
	/** @type {import('@testing-library/react-native').RenderAPI} */
	renderer;

	/**
	 * Creates an instance of ScreenTester.
	 * 
	 * @param {React.Component} Screen - The screen component to test.
	 * @param {Object} props - Props to pass to the screen component.
	 */
	constructor(Screen, props = {}) {
		this.renderer = render(<Screen {...props} />);
	};

	/**
	 * Simulates a button press on the screen.
	 * 
	 * @param {string} text - The text of the button to press.
	 */
	pressButton = text => {
		const { getByText } = this.renderer;
		const button = getByText(text);
		fireEvent.press(button);
	};

	/**
	 * Simulates typing text into a text box on the screen.
	 * 
	 * @param {string} label - The accessibility label of the text box.
	 * @param {string} text - The text to type into the text box.
	 */
	inputText = (label, text) => {
		const { getByLabelText } = this.renderer;
		const input = getByLabelText(label);
		fireEvent.changeText(input, text);
	};

	/**
	 * Asserts that the expected texts are present on the screen.
	 * 
	 * @param {string[]} expectedTextArray - An array of texts expected to be found.
	 */
	expectText = expectedTextArray => {
		const { getByText } = this.renderer;
		expectedTextArray.forEach(text => {
			expect(getByText(text)).toBeTruthy();
		});
	};

	/**
	 * Asserts that the unexpected texts are not present on the screen.
	 * 
	 * @param {string[]} unexpectedTextArray - An array of texts not expected to be found.
	 */
	notExpectText = unexpectedTextArray => {
		const { queryByText } = this.renderer;
		unexpectedTextArray.forEach(text => {
			expect(queryByText(text)).toBeNull();
		});
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
	 * Prints the current state of the rendered screen for debugging purposes.
	 */
	printDebug = () => {
		this.renderer.debug();
	};
}
