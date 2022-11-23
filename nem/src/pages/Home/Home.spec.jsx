/* eslint-disable testing-library/no-node-access */
import Home from '.';
import * as i18n from '../../i18n';
import * as styles from '../../utils/styles';
import {
	fireEvent, render, screen, waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';

const mockResizeObserverAndGetBreakpoint = (isPortrait, breakpointClassName) => {
	jest.spyOn(styles, 'getBreakpoint').mockImplementation(() => ({
		className: breakpointClassName,
		portrait: isPortrait
	}));
	window.ResizeObserver = jest.fn().mockImplementation(resize => {
		resize([{
			target: document.documentElement,
			contentRect: {}
		}]);

		return {
			observe: jest.fn()
		};
	});
};

describe('page/Home', () => {
	const recipientAddress = 'TBHGLHFK4FQUDQS3XBYKTQ3CMZLA227W5WPVAKPI';

	it('renders claim form when authorize with Twitter', () => {
		// Arrange:
		const buttonAuthText = i18n.$t('home_form_button_auth_twitter');

		// Act:
		render(<Home />);
		const elementButtonAuth = screen.queryByText(buttonAuthText);
		fireEvent.click(elementButtonAuth);

		// Assert:
		expect(screen.queryByText(buttonAuthText)).not.toBeInTheDocument();
	});

	describe('toast', () => {
		// Arrange:
		const formInputRecipient = i18n.$t('home_form_input_recipient_placeholder', { char: 'T' });
		const formInputAmount = i18n.$t('home_form_input_amount_placeholder', {
			currency: 'XEM',
			maxAmount: '500'
		});
		const formButton = i18n.$t('home_form_button_claim_text');

		const runBasicErrorToastTests = (inputFiled, formInput, expectedErrorMessage) => {
			it(`renders error toast when enter invalid ${inputFiled}`, () => {
				// Arrange:
				jest.spyOn(toast, 'error').mockImplementation(jest.fn());

				// Act:
				render(<Home />);
				const elementRecipient = screen.getByPlaceholderText(formInputRecipient);
				const elementAmount = screen.getByPlaceholderText(formInputAmount);
				const elementButton = screen.getByText(formButton);
				userEvent.type(elementRecipient, formInput.address);
				userEvent.type(elementAmount, formInput.amount);
				fireEvent.click(elementButton);

				// Assert:
				expect(toast.error).toHaveBeenCalledWith(i18n.$t(expectedErrorMessage));
			});
		}

		runBasicErrorToastTests(
			'address',
			{
				address: 'ABHGLHFK4FQUDQS3XBYKTQ3CMZLA227W5WPVAKPZ',
				amount: '100'
			},
			'notification_error_invalid_address')

		runBasicErrorToastTests(
			'amount',
			{
				address: recipientAddress,
				amount: '-100'
			},
			'notification_error_invalid_amount')

		it('renders info toast when enter valid data', () => {
			// Arrange:
			jest.spyOn(toast, 'info').mockImplementation(jest.fn());
			const amount = '100';

			// Act:
			render(<Home />);
			const elementRecipient = screen.getByPlaceholderText(formInputRecipient);
			const elementAmount = screen.getByPlaceholderText(formInputAmount);
			const elementButton = screen.getByText(formButton);
			userEvent.type(elementRecipient, recipientAddress);
			userEvent.type(elementAmount, amount);
			fireEvent.click(elementButton);

			// Assert:
			expect(toast.info).toHaveBeenCalledWith(i18n.$t('notification_info_requested', {
				amount,
				currency: 'XEM',
				address: recipientAddress
			}));
		});
	})

	describe('screen breakpoint', () => {
		const runBasicResizeBreakpointTests = (isPortrait, className, expectedResult) => {
			it(`renders page in ${isPortrait ? 'portrait' : 'landscape' } orientation with the class name when portrait boolean is ${isPortrait}`, async () => {
				// Arrange:
				mockResizeObserverAndGetBreakpoint(isPortrait, className);

				// Act:
				render(<Home />);

				// Assert:
				await waitFor(() => expect(screen.getByTestId('home-page-content').classList).toContain(expectedResult));
				expect(document.documentElement.classList).toContain(className);
			});
		}

		runBasicResizeBreakpointTests(true, 'breakpoint-class-1', 'page-container-portrait')
		runBasicResizeBreakpointTests(false, 'breakpoint-class-2', 'page-container-landscape')
	})
});
