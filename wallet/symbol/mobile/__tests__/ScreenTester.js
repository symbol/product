import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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
	 * @param {number} [index] - The index of the button if multiple elements have the same text.
	 */
	pressButton = (text, index) => {
		const { getByText, getAllByText } = this.renderer;
		let button;

		if (index !== undefined) {
			const buttons = getAllByText(text);
			button = buttons[index];
		} else {
			button = getByText(text);
		}

		fireEvent.press(button);
	};

	/**
	 * Simulates a button press by accessibility label on the screen.
	 * 
	 * @param {string} label - The accessibility label of the button to press.
	 * @param {number} [index] - The index of the button if multiple elements have the same label.
	 */
	presButtonByLabel = (label, index) => {
		const { getByLabelText, getAllByLabelText } = this.renderer;
		let button;

		if (index !== undefined) {
			const buttons = getAllByLabelText(label);
			button = buttons[index];
		} else {
			button = getByLabelText(label);
		}

		fireEvent.press(button);
	};

	/**
	 * Simulates typing text into a text box on the screen.
	 * 
	 * @param {string} label - The accessibility label of the text box.
	 * @param {string} text - The text to type into the text box.
	 * @param {number} [index] - The index of the text box if multiple elements have the same label.
	 */
	inputText = (label, text, index) => {
		const { getByLabelText, getAllByLabelText } = this.renderer;
		let input;

		if (index !== undefined) {
			const inputs = getAllByLabelText(label);
			input = inputs[index];
		} else {
			input = getByLabelText(label);
		}

		fireEvent.changeText(input, text);
	};

	/**
	 * Asserts that the expected texts are present on the screen.
	 * 
	 * @param {string[]} expectedTextArray - An array of texts expected to be found.
	 * @param {boolean} [isMultiple=false] - If true, checks for multiple occurrences of each text.
	 */
	expectText = (expectedTextArray, isMultiple = false) => {
		const { getByText, getAllByText } = this.renderer;
		expectedTextArray.forEach(text => {
			if (isMultiple) 
				expect(getAllByText(text).length).toBeGreaterThanOrEqual(1);
			 else 
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
	 * Asserts that an element with the specified testID is present on the screen.
	 * 
	 * @param {string} testID - The testID of the element to check for.
	 */
	expectElement = testID => {
		const { getByTestId } = this.renderer;
		expect(getByTestId(testID)).toBeTruthy();
	};

	/**
	 * Asserts that an element with the specified testID is not present on the screen.
	 * 
	 * @param {string} testID - The testID of the element to check for absence.
	 */
	notExpectElement = testID => {
		const { queryByTestId } = this.renderer;
		expect(queryByTestId(testID)).toBeNull();
	};

	/**
	 * Asserts that an input with the specified value is present on the screen.
	 * 
	 * @param {string} value - The value to check for.
	 */
	expectInputValue = value => {
		const { getByDisplayValue } = this.renderer;
		expect(getByDisplayValue(value)).toBeTruthy();
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
	 * @param {function} callback - The callback function to wait for.
	 */
	waitFor = async callback => {
		await waitFor(callback);
	};

	/**
	 * Prints the current state of the rendered screen for debugging purposes.
	 */
	printDebug = () => {
		this.renderer.debug();
	};
}
