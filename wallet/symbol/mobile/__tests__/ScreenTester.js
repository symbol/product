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
	 * Asserts that the accessibility value of an element matches the expected value.
	 * 
	 * @param {string} label - The accessibility label of the element.
	 * @param {any} expectedValue - The expected accessibility value.
	 */
	expectAccessibilityValue = (label, expectedValue) => {
		const { getByLabelText} = this.renderer;
		const element = getByLabelText(label);

		expect(element.props.accessibilityValue).toBe(expectedValue);
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
	 * Simulates pressing a button/element by its testID.
	 * This finds the element and then traverses up to find the nearest pressable ancestor.
	 * 
	 * @param {string} testID - The testID of the element or its child to press.
	 * @param {number} [index] - The index of the element if multiple elements have the same testID.
	 */
	pressButtonByTestId = (testID, index) => {
		const { getByTestId, getAllByTestId } = this.renderer;
		let element;

		if (index !== undefined) {
			const elements = getAllByTestId(testID);
			element = elements[index];
		} else {
			element = getByTestId(testID);
		}

		// Find the nearest pressable parent
		let current = element;
		while (current && !current.props?.onPress) 
			current = current.parent;
		

		if (current?.props?.onPress) {
			fireEvent.press(current);
		} else {
			// Fallback: try pressing the element itself
			fireEvent.press(element);
		}
	};

	/**
	 * Asserts that an element with the specified testID is present on the screen.
	 * 
	 * @param {string} testID - The testID of the element to check for.
	 * @param {'testId'|'text'|'label'} [by='testId'] - Optional method to find the element (not used currently).
	 */
	expectElement = (testID, by = 'testId') => {
		const { getByTestId, getByText, getByLabelText } = this.renderer;
		switch (by) {
		case 'text':
			expect(getByText(testID)).toBeTruthy();
			break;
		case 'label':
			expect(getByLabelText(testID)).toBeTruthy();
			break;
		case 'testId':
		default:
			expect(getByTestId(testID)).toBeTruthy();
			break;
		}
	};

	/**
	 * Asserts that an element with the specified testID is not present on the screen.
	 * 
	 * @param {string} testID - The testID of the element to check for absence.
	 * @param {'testId'|'text'|'label'} [by='testId'] - Optional method to find the element (not used currently).
	 */
	notExpectElement = (testID, by = 'testId') => {
		const { queryByTestId, queryByText, queryByLabelText } = this.renderer;
		switch (by) {
		case 'text':
			expect(queryByText(testID)).toBeNull();
			break;
		case 'label':
			expect(queryByLabelText(testID)).toBeNull();
			break;
		case 'testId':
		default:
			expect(queryByTestId(testID)).toBeNull();
			break;
		}
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
	 * Finds if an element or any of its ancestors has a disabled prop set to true.
	 * 
	 * @param {Object} element - The element to check.
	 * @param {number} maxDepth - Maximum depth to traverse up the tree.
	 * @returns {boolean} Whether the element or any ancestor is disabled.
	 */
	_isElementDisabled = (element, maxDepth = 10) => {
		let current = element;
		let depth = 0;
		
		while (current && depth < maxDepth) {
			if (current.props?.disabled === true || current.props?.accessibilityState?.disabled === true) 
				return true;
			
			current = current.parent;
			depth++;
		}
		
		return false;
	};

	/**
	 * Asserts that a button with the specified text is disabled.
	 * Checks the parent Pressable component's disabled prop.
	 * 
	 * @param {string} text - The text of the button to check.
	 */
	expectButtonDisabled = text => {
		const { getByText } = this.renderer;
		const button = getByText(text);
		expect(this._isElementDisabled(button)).toBe(true);
	};

	/**
	 * Asserts that a button with the specified text is enabled.
	 * 
	 * @param {string} text - The text of the button to check.
	 */
	expectButtonEnabled = text => {
		const { getByText } = this.renderer;
		const button = getByText(text);
		expect(this._isElementDisabled(button)).toBe(false);
	};

	/**
	 * Selects an option from a dropdown by pressing the dropdown and then the option.
	 * 
	 * @param {string} dropdownLabel - The current value or label of the dropdown to open.
	 * @param {string} optionText - The text of the option to select.
	 */
	selectDropdownOption = (dropdownLabel, optionText) => {
		this.pressButton(dropdownLabel);
		this.pressButton(optionText);
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
