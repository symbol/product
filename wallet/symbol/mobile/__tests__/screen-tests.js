import { mockRouter } from '__tests__/mock-helpers';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

/**
 * Helper function to test screen navigation actions.
 * 
 * @param {React.Component} Screen - The screen component to test.
 * @param {Object} config - Configuration object for the test.
 * @param {Array<{buttonText: string, actionName: string}>} config.navigationActions - Navigation actions to test.
 * @param {Object} [config.props] - Optional props to pass to the screen component.
 */
export const runScreenNavigationTest = (Screen, config) => {
	const { navigationActions, props = {} } = config;

	describe('navigation actions', () => {
		navigationActions.forEach(({ buttonText, buttonLabel, actionName }) => {
			const text = buttonText || buttonLabel;
			const selectorType = buttonText ? 'text' : 'label';

			it(`calls ${actionName} when "${text}" is pressed`, () => {
				// Arrange:
				const mocks = mockRouter({
					...navigationActions.reduce((acc, { actionName }) => {
						acc[actionName] = jest.fn();
						return acc;
					}, {})
				});

				// Act:
				const { getByText, getByLabelText } = render(<Screen {...props} />);
				const getButton = selectorType === 'text' ? getByText : getByLabelText;
				const button = getButton(text);
				fireEvent.press(button);

				// Assert:
				const action = mocks[actionName];
				expect(action).toHaveBeenCalledTimes(1);
			});
		});
	});
};
