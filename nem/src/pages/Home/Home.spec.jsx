/* eslint-disable testing-library/no-node-access */
import Home from '.';
import * as i18n from '../../i18n';
import * as styles from '../../utils/styles';
import {
	fireEvent, render, screen, waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import mockAxios from 'axios';

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
	// Arrange:
	const recipientAddress = 'TBHGLHFK4FQUDQS3XBYKTQ3CMZLA227W5WPVAKPI';

	// decoded jwt payload
	// {
	// 	"accessToken": "accessToken1234",
	// 	"accessSecret": "accessSecret1234",
	// 	"screenName": "twitterAccount",
	// 	"followersCount": 100,
	// 	"createdAt": "2011-06-07T14:17:46.000Z",
	// 	"iat": 1670704886
	// }
	const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
	+ 'eyJhY2Nlc3NUb2tlbiI6ImFjY2Vzc1Rva2VuMTIzNCIsImFjY2Vzc1NlY3JldCI6ImFjY2Vzc1NlY3JldDEyMzQiLCJzY3JlZW5OYW1lIjo'
	+ 'idHdpdHRlckFjY291bnQiLCJmb2xsb3dlcnNDb3VudCI6MTAwLCJjcmVhdGVkQXQiOiIyMDExLTA2LTA3VDE0OjE3OjQ2LjAwMFoiLCJpYX'
	+ 'QiOjE2NzA3MDQ4ODZ9.PDZOY7EXRr_qknErLfqXqymJ8Ivg4nNiSFvJBSG56f0';

	const createLocalStorageTwitterInfo = (jwtAuthToken = jwtToken) => {
		localStorage.setItem('authToken', jwtAuthToken);
	};

	beforeEach(() => createLocalStorageTwitterInfo());

	afterEach(() => localStorage.clear());

	it('renders claim form when authorize with Twitter', () => {
		// Arrange:
		const buttonAuthText = i18n.$t('home_form_button_auth_twitter');

		// Act:
		render(<Home />);
		const elementButtonAuth = screen.queryByText(buttonAuthText);

		// Assert:
		expect(elementButtonAuth).not.toBeInTheDocument();
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

		const assertTwitterAccountToastError = (info = {}) => {
			// Arrange:
			createLocalStorageTwitterInfo(info);

			// Act:
			render(<Home />);
			const elementRecipient = screen.getByPlaceholderText(formInputRecipient);
			const elementAmount = screen.getByPlaceholderText(formInputAmount);
			const elementButton = screen.getByText(formButton);
			userEvent.type(elementRecipient, recipientAddress);
			userEvent.type(elementAmount, '100');
			fireEvent.click(elementButton);

			// Assert:
			expect(toast.error).toHaveBeenCalledWith(i18n.$t('notification_error_unqualified_twitter_account'));
		};

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

		it('renders error toast when twitter account followersCount less than 10', () => assertTwitterAccountToastError('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NUb2tlbiI6ImFjY2Vzc1Rva2VuMTIzNCIsImFjY2Vzc1NlY3JldCI6ImFjY2Vzc1NlY3JldDEyMzQiLCJzY3JlZW5OYW1lIjoidHdpdHRlckFjY291bnQiLCJmb2xsb3dlcnNDb3VudCI6NSwiY3JlYXRlZEF0IjoiMjAxMS0wNi0wN1QxNDoxNzo0Ni4wMDBaIiwiaWF0IjoxNjcwNzA0ODg2fQ.Y-MenesuV6tQ8arh8_3lvNG2w3lVvstc7iDYqDRwikM'));

		it('renders error toast when twitter account registered less than 31 days', () => assertTwitterAccountToastError('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NUb2tlbiI6ImFjY2Vzc1Rva2VuMTIzNCIsImFjY2Vzc1NlY3JldCI6ImFjY2Vzc1NlY3JldDEyMzQiLCJzY3JlZW5OYW1lIjoidHdpdHRlckFjY291bnQiLCJmb2xsb3dlcnNDb3VudCI6NSwiY3JlYXRlZEF0IjoiMjAyMi0xMS0wN1QxNDoxNzo0Ni4wMDBaIiwiaWF0IjoxNjcwNzA0ODg2fQ.IJ-VgWo8KWj7FjikXH0XDnhazTRcqAkjy-jM1OEud5w'));

		describe('claimToken', () => {
			const createAxiosError = (code, errorMessage) => {
				return {
					response: {
						data: {
							code,
							message: errorMessage
						}
					}
				}
			};

			const assertServiceResponseErrorTests = async (serverResponse, expectResult) => {
				// Arrange:
				jest.spyOn(toast, 'error').mockImplementation(jest.fn());

				mockAxios.post.mockRejectedValueOnce(serverResponse);

				// Act:
				render(<Home />);
				const elementRecipient = screen.getByPlaceholderText(formInputRecipient);
				const elementAmount = screen.getByPlaceholderText(formInputAmount);
				const elementButton = screen.getByText(formButton);
				userEvent.type(elementRecipient, recipientAddress);
				userEvent.type(elementAmount, '100');
				fireEvent.click(elementButton);

				// Assert:
				expect(mockAxios.post).toHaveBeenCalledWith('/claim/xem', {
					address: recipientAddress,
					amount: 100
				}, {
					headers: {
						'Content-Type': 'application/json',
						'authToken': jwtToken
					}
				});

				await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.$t(expectResult)));
			}

			it('renders error toast when service response notification_error_amount_max_request', async () => {
				await assertServiceResponseErrorTests(
					createAxiosError('BadRequest', 'error_amount_max_request'),
					'notification_error_amount_max_request'
				);
			});

			it('renders error toast when service response error_account_high_balance', async () => {
				await assertServiceResponseErrorTests(
					createAxiosError('BadRequest', 'error_account_high_balance'),
					'notification_error_account_high_balance'
				);
			});

			it('renders error toast when service response error_fund_drains', async () => {
				await assertServiceResponseErrorTests(
					createAxiosError('BadRequest', 'error_fund_drains'),
					'notification_error_fund_drains'
				);
			});

			it('renders error toast when service response error_transaction_pending', async () => {
				await assertServiceResponseErrorTests(createAxiosError('BadRequest', 'error_transaction_pending'), 'notification_error_transaction_pending');
			});

			it('renders error toast when service response notification_error_nem_node', async () => {
				await assertServiceResponseErrorTests(createAxiosError('Internal', 'random error'), 'notification_error_nem_node');
			});

			it('renders error toast when service not response', async () => {
				await assertServiceResponseErrorTests({
					request: {}
				}, 'notification_error_backend_not_responding');
			});

			it('renders error toast when frontend request fail', async () => {
				await assertServiceResponseErrorTests({}, 'notification_error_frontend_request_fail');
			});

			it('renders info toast when service response valid data', async () => {
				// Arrange:
				jest.spyOn(toast, 'info').mockImplementation(jest.fn());

				mockAxios.post.mockReturnValue({
					data: {
						transactionHash: 'transaction_hash',
					}
				});

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
				expect(mockAxios.post).toHaveBeenCalledWith('/claim/xem', {
					address: recipientAddress,
					amount: 100
				}, {
					headers: {
						'Content-Type': 'application/json',
						'authToken': jwtToken
					}
				});

				await waitFor(() => expect(toast.info).toHaveBeenCalledWith(i18n.$t('notification_info_requested', {
					amount,
					currency: 'XEM',
					address: recipientAddress
				})));
				expect(toast.info).toHaveBeenCalledWith(<a href="https://testnet-explorer.nemtool.com//#/s_tx?hash=transaction_hash" target="_blank">View in Explorer</a>)
			});
		})
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
