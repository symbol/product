import { mockRouter } from '__tests__/mock-helpers';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

/**
 * Helper function to test screen navigation actions.
 * 
 * @param {React.Component} Screen - The screen component to test.
 * @param {Object} config - Configuration object for the test.
 * @param {Array<{buttonText: string, actionName: string}>} config.navigationActions - Navigation actions to test.
 */
export const runScreenNavigationTest = (Screen, config) => {
	const { navigationActions } = config;

	describe('navigation actions', () => {
		navigationActions.forEach(({ buttonText, actionName }) => {
			it(`calls ${actionName} when "${buttonText}" is pressed`, () => {
				// Arrange:
				const mocks = mockRouter({
					...navigationActions.reduce((acc, { actionName }) => {
						acc[actionName] = jest.fn();
						return acc;
					}, {})
				});

				// Act:
				const { getByText } = render(<Screen />);
				const button = getByText(buttonText);
				fireEvent.press(button);

				// Assert:
				const action = mocks[actionName];
				expect(action).toHaveBeenCalledTimes(1);
			});
		});
	});
};
