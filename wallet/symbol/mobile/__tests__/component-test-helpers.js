import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

export const expectText = async (screenRender, expectedTextList, shouldBeRendered = true) => {
	// Arrange:
	const {
		getByText,
		getByPlaceholderText,
		queryByText,
		queryByPlaceholderText
	} = screenRender;
	const findMap = {
		text: shouldBeRendered ? getByText : queryByText,
		placeholder: shouldBeRendered 
			? getByPlaceholderText 
			: queryByPlaceholderText
	};

	// Assert:
	expectedTextList.forEach(({ type, value }) => {
		const finder = findMap[type];

		if (shouldBeRendered) 
			expect(finder(value)).toBeTruthy();
		else 
			expect(finder(value)).toBeNull();
		
	});
};

/**
 * @typedef {'text' | 'placeholder'} TextType
 */
/**
 * @typedef {Object} RenderText
 * @property {TextType} type - The type of text to render ('text' or 'placeholder').
 * @property {string} value - The actual text value to be rendered.
 */

/**
 * Helper function to test rendering of React Native components.
 * 
 * @param {Object} config - Configuration object for the test.
 * @param {React.Component} config.Component - The React Native component to be tested.
 * @param {Object} config.props - Props to be passed to the component.
 * @param {React.ReactNode} [config.children] - Children to be passed to the component.
 * @param {RenderText[]} [config.textToRender] - The text expected to be rendered by the component.
 */
export const testRenderWith = (config, expected = {}) => {
	// Arrange:
	const { Component, props, textToRender } = config;
	const { shouldBeRendered = true } = expected;

	// Act:
	const renderer = render(<Component {...props} />);
	
	// Assert:
	expect(renderer.root).toBeTruthy();

	if (textToRender)
		expectText(renderer, textToRender, shouldBeRendered);
};

/**
 * Helper function to test press events on React Native components.
 * 
 * @param {Object} config - Configuration object for the test.
 * @param {React.Component} config.Component - The React Native component to be tested.
 * @param {Object} config.props - Props to be passed to the component.
 * @param {string} config.textToPress - The text of the element to be pressed.
 * @param {string} [config.eventPropName='onPress'] - The name of the event prop to be tested.
 * @param {boolean} [config.skipCallback=false] - If true, does not pass the callback to the component.
 */
export const testPressEvent = (config, expected = {}) => {
	// Arrange:
	const {
		Component,
		props,
		textToPress,
		eventPropName = 'onPress',
		skipCallback = false
	} = config;
	const { shouldFireEvent, eventArguments = [] } = expected;
	const callback = jest.fn();
	const componentProps = skipCallback 
		? { ...props } 
		: { ...props, [eventPropName]: callback };

	// Act:
	const { getByText } = render(<Component {...componentProps} />);
	const buttonElement = getByText(textToPress);
	fireEvent.press(buttonElement);

	// Assert:
	if (skipCallback) {
		// If callback is skipped, we just verify no error was thrown
		expect(true).toBe(true);
		return;
	}

	if (shouldFireEvent)
		expect(callback).toHaveBeenCalled();
	else
		expect(callback).not.toHaveBeenCalled();

	if (shouldFireEvent && eventArguments.length)
		expect(callback).toHaveBeenCalledWith(...eventArguments);
};

/**
 * Helper function to test text input events on React Native components.
 * 
 * @param {Object} config - Configuration object for the test.
 * @param {React.Component} config.Component - The React Native component to be tested.
 * @param {Object} config.props - Props to be passed to the component.
 * @param {boolean} config.shouldFireEvent - Indicates if the event should be fired.
 * @param {string} config.textToInput - The text to input into the element.
 * @param {string} [config.eventPropName='onChange'] - The name of the event prop to be tested.
 * @param {{ type: 'placeholder' | 'input' | 'label', value: string }} [config.textToFocus]
 * Target to locate the input (by placeholder or by current value).
 * @param {*} [config.expectedEventArguments] - Expected values to be passed to the event handler.
 * @param {boolean} [config.skipCallback=false] - If true, does not pass the callback to the component.
 */
export const testTextInputEvent = async (config, expected = {}) => {
	// Arrange:
	const {
		Component,
		props,
		textToInput,
		eventPropName = 'onChange',
		textToFocus,
		skipCallback = false
	} = config;
	const { shouldFireEvent, eventArguments = [textToInput] } = expected;
	const callback = jest.fn();
	const componentProps = skipCallback 
		? { ...props } 
		: { ...props, [eventPropName]: callback };

	// Act:
	const {
		getByPlaceholderText,
		getByDisplayValue,
		getByLabelText
	} = render(<Component {...componentProps} />);
	const focusTarget = textToFocus;
	const focusFinders = {
		placeholder: getByPlaceholderText,
		input: getByDisplayValue,
		label: getByLabelText
	};
	const inputElement = focusFinders[focusTarget.type](focusTarget.value);
	fireEvent.changeText(inputElement, textToInput);

	// Assert:
	if (skipCallback) {
		// If callback is skipped, we just verify no error was thrown
		expect(true).toBe(true);
		return;
	}

	if (shouldFireEvent)
		expect(callback).toHaveBeenCalled();
	else
		expect(callback).not.toHaveBeenCalled();

	if (shouldFireEvent && eventArguments.length)
		expect(callback).toHaveBeenCalledWith(...eventArguments);
};
