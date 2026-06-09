import { testDropdownSelectEvent, testPressEvent, testRenderWith, testTextInputEvent } from './component-test-helpers';
import React from 'react';

/** @typedef {import('./component-test-helpers').RenderText} RenderText */

/**
 * @typedef {object} VisibilityTest
 * @property {object} props - The props to be passed to the component.
 * @property {RenderText[]} textToRender - The text expected to be rendered by the component.
 */

/**
 * Runs visibility tests for a given component.
 * 
 * @param {React.Component} Component - The React Native component to be tested.
 * @param {VisibilityTest} config - Configuration object for the test.
 */
export const runVisibilityTest = (Component, config) => {
	const { props, textToRender } = config;
	const cases = [
		{ 
			description: 'renders component when isVisible is true', 
			isVisible: true 
		},
		{ 
			description: 'does not render component when isVisible is false', 
			isVisible: false 
		}
	];

	describe('visibility', () => {
		cases.forEach(testCase => {
			it(testCase.description, () => {
				const config = {
					Component,
					props: { ...props, isVisible: testCase.isVisible },
					textToRender: textToRender
				};
				const expected = {
					shouldBeRendered: testCase.isVisible
				};
				testRenderWith(config, expected);
			});
		});
	});
};

/**
 * @typedef {object} SwitchPressTest
 * @property {object} props - The props to be passed to the component.
 * @property {string} textToPress - The text of the element to be pressed.
 * @property {string} [labelToPress] - The accessibility label of the element to be pressed (used if textToPress is not provided).
 */

/**
 * Runs switch press tests for a given component.
 * 
 * @param {React.Component} Component - The React Native component to be tested.
 * @param {SwitchPressTest} config - Configuration object for the test.
 */
export const runSwitchPressTest = (Component, config) => {
	const { props, textToPress, labelToPress } = config;
	const cases = [
		{ 
			description: 'fires event from off to on',
			isDisabled: false,
			initialValue: false, 
			shouldFireEvent: true,
			expectedValue: true
		},
		{
			description: 'fires event from on to off',
			isDisabled: false,
			initialValue: true,
			shouldFireEvent: true,
			expectedValue: false
		},
		{
			description: 'does not fire event when isDisabled is true',
			isDisabled: true,
			initialValue: false,
			shouldFireEvent: false
		}
	];

	describe('onChange', () => {
		cases.forEach(async testCase => {
			it(testCase.description, async () => {
				const testConfig = {
					Component,
					props: { 
						...props, 
						value: testCase.initialValue,
						isDisabled: testCase.isDisabled
					},
					textToPress: textToPress,
					labelToPress: labelToPress,
					eventPropName: 'onChange'
				};
				const expected = {
					shouldFireEvent: testCase.shouldFireEvent,
					eventArguments: [testCase.expectedValue]
				};

				testPressEvent(testConfig, expected);
			});
		});
	});
};

/**
 * @typedef {object} PressTest
 * @property {object} props - The props to be passed to the component.
 * @property {string} textToPress - The text of the element to be pressed.
 * @property {string} [labelToPress] - The accessibility label of the element to be pressed (used if textToPress is not provided).
 * @property {boolean} [testDisabledState] - Whether to test the disabled state of the component.
 */

/**
 * Runs press tests for a given component.
 * 
 * @param {React.Component} Component - The React Native component to be tested.
 * @param {PressTest} config - Configuration object for the test.
 */
export const runPressTest = (Component, config) => {
	const { props, textToPress, labelToPress, testDisabledState } = config;
	const cases = [
		{ 
			description: 'fires event when pressed',
			isDisabled: false,
			shouldFireEvent: true
		},
		{
			description: 'does not throw when onPress callback is not provided',
			isDisabled: false,
			skipCallback: true
		}
	];

	if (testDisabledState) {
		cases.push({
			description: 'does not fire event when isDisabled is true',
			isDisabled: true,
			shouldFireEvent: false
		});
	}

	describe('onPress', () => {
		cases.forEach(async testCase => {
			it(testCase.description, async () => {
				const testConfig = {
					Component,
					props: { 
						...props, 
						isDisabled: testCase.isDisabled
					},
					textToPress: textToPress,
					labelToPress: labelToPress,
					eventPropName: 'onPress',
					skipCallback: testCase.skipCallback || false
				};
				const expected = {
					shouldFireEvent: testCase.shouldFireEvent
				};

				testPressEvent(testConfig, expected);
			});
		});
	});
};


/**
 * @typedef {object} RenderTextTest
 * @property {object} props - The props to be passed to the component.
 * @property {RenderText[]} textToRender - The text expected to be rendered by the component.
 */

/**
 * Runs render text tests for a given component.
 * 
 * @param {React.Component} Component - The React Native component to be tested.
 * @param {RenderTextTest} config - Configuration object for the test.
 */
export const runRenderTextTest = (Component, config) => {
	const { props = {}, textToRender } = config;
	const cases = [
		{ 
			description: 'renders component with text', 
			shouldBeRendered: true 
		}
	];

	describe('render', () => {
		cases.forEach(testCase => {
			it(testCase.description, () => {
				const config = {
					Component,
					props,
					textToRender
				};
				const expected = {
					shouldBeRendered: testCase.shouldBeRendered
				};
				testRenderWith(config, expected);
			});
		});
	});
};

/**
 * @typedef {object} InputTextTest
 * @property {object} props - The props to be passed to the component.
 * @property {{ type: 'placeholder' | 'input', value: string }} [textToFocus] - Target to locate the input 
 * (by placeholder or by current value).
 * @property {string} [textToInput] - Custom text to input (defaults to 'Hello, World!').
 * @property {Array} [expectedEventArguments] - Custom expected arguments for the onChange callback.
 * @property {boolean} [testDisabledState] - Whether to test the disabled state of the input.
 */

/**
 * Runs text input change tests for a given component.
 *
 * @param {React.Component} Component - The React Native component to be tested.
 * @param {InputTextTest} config - Configuration object for the test.
 */
export const runInputTextTest = (Component, config) => {
	const { props, textToFocus, textToInput: customTextToInput, expectedEventArguments, testDisabledState } = config;
	const textToInput = customTextToInput || 'Hello, World!';
	const cases = [
		{
			description: 'fires onChange event when text is input',
			isDisabled: false,
			shouldFireEvent: true
		},
		{
			description: 'does not throw when onChange callback is not provided',
			isDisabled: false,
			skipCallback: true
		}
	];

	if (testDisabledState) {
		cases.push({
			description: 'does not fire onChange event when input is disabled',
			isDisabled: true,
			shouldFireEvent: false
		});
	}

	describe('onChange', () => {
		cases.forEach(testCase => {
			it(testCase.description, async () => {
				const testConfig = {
					Component,
					props: {
						...props,
						isDisabled: testCase.isDisabled
					},
					textToInput,
					textToFocus,
					eventPropName: 'onChange',
					skipCallback: testCase.skipCallback || false
				};
				const expected = {
					shouldFireEvent: testCase.shouldFireEvent,
					eventArguments: expectedEventArguments
				};

				await testTextInputEvent(testConfig, expected);
			});
		});
	});
};

/**
 * Runs a basic render test for a given component.
 * 
 * @param {React.Component} Component - The React Native component to be tested.
 * @param {object} [config] - Configuration object for the test.
 * @param {object} [config.props={}] - Props to be passed to the component.
 */
export const runRenderComponentTest = (Component, config = {}) => {
	const { props = {} } = config;
	it('renders component without crashing', () => {
		const testConfig = {
			Component,
			props
		};
		const expected = {};
		testRenderWith(testConfig, expected);
	});
};

/**
 * @typedef {object} DropdownSelectItem
 * @property {string} label - The text label displayed for the item.
 * @property {*} value - The value of the item when selected.
 */

/**
 * @typedef {object} DropdownSelectTest
 * @property {object} props - The props to be passed to the component.
 * @property {string} textToPress - The text of the element to press to open the dropdown.
 * @property {DropdownSelectItem[]} items - The list of items in the dropdown.
 * @property {boolean} [testDisabledState] - Whether to test the disabled state of the component.
 */

/**
 * Runs dropdown selection tests for a given component.
 * 
 * @param {React.Component} Component - The React Native component to be tested.
 * @param {DropdownSelectTest} config - Configuration object for the test.
 */
export const runDropdownSelectTest = (Component, config) => {
	const { props, textToPress, items, testDisabledState } = config;
	const cases = [
		{
			description: 'fires onChange event when item is selected',
			isDisabled: false,
			shouldFireEvent: true
		},
		{
			description: 'does not throw when onChange callback is not provided',
			isDisabled: false,
			skipCallback: true
		}
	];

	if (testDisabledState) {
		cases.push({
			description: 'does not fire onChange event when isDisabled is true',
			isDisabled: true,
			shouldFireEvent: false
		});
	}

	describe('onChange', () => {
		cases.forEach(testCase => {
			it(testCase.description, async () => {
				const testConfig = {
					Component,
					props: {
						...props,
						isDisabled: testCase.isDisabled
					},
					textToPress,
					items,
					eventPropName: 'onChange',
					skipCallback: testCase.skipCallback || false
				};
				const expected = {
					shouldFireEvent: testCase.shouldFireEvent
				};

				await testDropdownSelectEvent(testConfig, expected);
			});
		});
	});
};
