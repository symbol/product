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
		const mocks = mockRouter({
			...navigationActions.reduce((acc, { actionName }) => {
				acc[actionName] = jest.fn();
				return acc;
			}, {})
		});

		navigationActions.forEach(({ buttonText, actionName }) => {
			it(`calls ${actionName} when "${buttonText}" is pressed`, () => {
				const { getByText } = render(<Screen />);
				const button = getByText(buttonText);
				fireEvent.press(button);

				const action = mocks[actionName];
				expect(action).toHaveBeenCalledTimes(1);
			});
		});
	});
};
