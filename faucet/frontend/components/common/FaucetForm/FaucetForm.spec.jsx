import FaucetForm from '.';
import { jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';

describe('components/FaucetForm', () => {
	// Arrange:
	const config = {
		claimUrl: '/claim/url',
		authUrl: 'http://auth.url',
		backendUrl: 'http://backend.url',
		transactionHashExplorerUrl: 'http://explorer.url/transaction/',
		maxAmount: 1000,
		currency: 'TOKEN',
		addressFirstChar: 'X',
		minFollowers: 10,
		minAccountAge: 30,
		theme: 'dark'
	};

	beforeEach(() => {
		jest.spyOn(axios, 'create').mockReturnValue({
			post: (url, params, config) => axios.post(url, params, config),
			defaults: {}
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	const recipientAddress = 'TBHGLHFK4FQUDQS3XBYKTQ3CMZLA227W5WPVAKPI';

	const formInputRecipient = $t('home_form_input_recipient_placeholder', { char: config.addressFirstChar });
	const formInputAmount = $t('home_form_input_amount_placeholder', {
		currency: config.currency,
		maxAmount: config.maxAmount,
		defaultAmount: config.maxAmount * 0.2
	});
	const formButtonClaim = $t('home_form_button_claim_text');
	const formAuthDescription = $t('home_form_auth_description');
	const formButtonAuthTwitter = $t('home_form_button_auth_twitter');

	describe('when user is not signed in', () => {
		it('renders form auth description and twitter auth button', () => {
			// Act:
			render(<FaucetForm
				config={config}
				addressValidation={jest.fn(() => true)}
			/>);

			const elementText = screen.getByText(formAuthDescription);
			const elementTwitterAuthButton = screen.queryByText(formButtonAuthTwitter);
			const elementClaimButton = screen.queryByText(formButtonClaim);

			// Assert:
			expect(elementText).toBeInTheDocument();
			expect(elementTwitterAuthButton).toBeInTheDocument();
			expect(elementClaimButton).not.toBeInTheDocument();
		});

		it('store recipient address in local storage when params recipient is exist', () => {
			// Arrange:
			const queryParams = '?recipient=recipient-address';
			delete window.location;
			window.location = new URL(`http://example.com${queryParams}`);

			// Act:
			render(<FaucetForm
				config={config}
				addressValidation={jest.fn()}
			/>);

			// Assert:
			expect(sessionStorage.getItem('recipientAddress')).toBe('recipient-address');
		});
	});

	describe('when user signed in', () => {
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

		const createSessionStorageTwitterInfo = (jwtAuthToken = jwtToken) => {
			sessionStorage.setItem('authToken', jwtAuthToken);
		};

		// mock user event
		let user = {};

		beforeEach(() => {
			createSessionStorageTwitterInfo();
			user = userEvent.setup();
		});

		afterEach(() => sessionStorage.clear());

		it('renders input form', () => {
			// Act:
			render(<FaucetForm
				config={config}
				addressValidation={jest.fn(() => true)}
			/>);
			const elementRecipient = screen.getByPlaceholderText(formInputRecipient);
			const elementAmount = screen.getByPlaceholderText(formInputAmount);
			const elementButton = screen.getByText(formButtonClaim);
			const elementAuthDescription = screen.queryByText(formAuthDescription);

			// Assert:
			expect(elementRecipient).toBeInTheDocument();
			expect(elementAmount).toBeInTheDocument();
			expect(elementButton).toBeInTheDocument();
			expect(elementAuthDescription).not.toBeInTheDocument();
		});

		it('sets the recipient address when query params present', async () => {
			// Arrange:
			const queryParams = '?recipient=recipient-address';
			delete window.location;
			window.location = new URL(`http://example.com${queryParams}`);

			// Act:
			render(<FaucetForm
				config={config}
				addressValidation={jest.fn(() => true)}
			/>);

			const elementRecipient = screen.getByPlaceholderText(formInputRecipient);

			// Assert:
			expect(elementRecipient.value).toBe('recipient-address');
		});

		it('sets the recipient address from sessionStorage when not available in query params', async () => {
			// Arrange:
			delete window.location;
			window.location = new URL('http://example.com');

			sessionStorage.setItem('recipientAddress', 'local-storage-recipient-address');

			// Act:
			render(<FaucetForm
				config={config}
				addressValidation={jest.fn(() => true)}
			/>);

			const elementRecipient = screen.getByPlaceholderText(formInputRecipient);

			// Assert:
			expect(elementRecipient.value).toBe('local-storage-recipient-address');
		});

		describe('formSubmitHandler', () => {
			const assertSubmitFormAmount = async (amount, expectedAmount) => {
				// Arrange:
				jest.spyOn(axios, 'post').mockReturnValue({
					data: {
						transactionHash: 'transaction_hash'
					}
				});

				// Act:
				render(<FaucetForm
					config={config}
					addressValidation={jest.fn(() => true)}
				/>);

				const elementRecipient = screen.getByPlaceholderText(formInputRecipient);
				const elementAmount = screen.getByPlaceholderText(formInputAmount);
				const elementButton = screen.getByText(formButtonClaim);
				await user.type(elementRecipient, recipientAddress);
				await user.type(elementAmount, amount);
				fireEvent.click(elementButton);

				// Assert:
				expect(elementButton).toBeDisabled();
				await waitFor(() => {
					expect(axios.post).toHaveBeenCalledWith('/claim/url', {
						address: recipientAddress,
						amount: expectedAmount,
						twitterHandle: 'twitterAccount'

					}, {
						headers: {
							'Content-Type': 'application/json',
							'authToken': jwtToken
						}
					});
				});
				expect(elementButton).toBeEnabled();
			};

			it('returns default amount when amount is empty', async () => {
				await assertSubmitFormAmount(' ', config.maxAmount * 0.2);
			});

			it('returns input amount when amount not empty', async () => {
				await assertSubmitFormAmount('100', 100);
			});

			it('returns 3 decimal amount when amount not empty', async () => {
				await assertSubmitFormAmount('100.123', 100.123);
			});

			it('returns max 6 decimal amount when amount not empty', async () => {
				await assertSubmitFormAmount('100.1234567', 100.123456);
			});
		});

		describe('toast', () => {
			const assertToast = (toastElement, toastProgressbar, message, toastType) => {
				const toastifyClassName = 'Toastify__toast';
				const toastDiv = toastElement.closest(`.${toastifyClassName}`);

				// verify toast message
				expect(toastElement).toHaveTextContent(message);

				// verify toast type
				expect(toastDiv).toHaveClass(`${toastifyClassName}--${toastType}`);

				// verify toast style
				expect(toastDiv).toHaveClass(`${toastifyClassName}-theme--${config.theme}`);
				expect(toastProgressbar).toHaveClass('toast-progress');
				expect(toastElement).toHaveClass('toast-body');
			};

			const runBasicErrorToastTests = (inputFiled, formInput, expectedErrorMessage) => {
				it(`renders error toast when enter invalid ${inputFiled}`, async () => {
					// Act:
					render(<FaucetForm
						config={config}
						addressValidation={address => !('T' !== address[0])}
					/>);
					const elementRecipient = screen.getByPlaceholderText(formInputRecipient);
					const elementAmount = screen.getByPlaceholderText(formInputAmount);
					const elementButton = screen.getByText(formButtonClaim);
					await user.type(elementRecipient, formInput.address);
					await user.type(elementAmount, formInput.amount);
					fireEvent.click(elementButton);

					// Assert:
					const toastElement = await screen.findByRole('alert');
					const toastProgressbar = await screen.findByRole('progressbar');

					assertToast(toastElement, toastProgressbar, $t(expectedErrorMessage), 'error');
				});
			};

			runBasicErrorToastTests(
				'address',
				{
					address: 'ABHGLHFK4FQUDQS3XBYKTQ3CMZLA227W5WPVAKPZ',
					amount: '100'
				},
				'notification_error_address_invalid'
			);

			runBasicErrorToastTests(
				'amount',
				{
					address: recipientAddress,
					amount: '100000'
				},
				'notification_error_amount_invalid'
			);

			const assertTwitterAccountToastError = async (info = {}) => {
				// Arrange:
				createSessionStorageTwitterInfo(info);

				// Act:
				render(<FaucetForm
					config={config}
					addressValidation={jest.fn(() => true)}
				/>);
				const elementRecipient = screen.getByPlaceholderText(formInputRecipient);
				const elementAmount = screen.getByPlaceholderText(formInputAmount);
				const elementButton = screen.getByText(formButtonClaim);
				await user.type(elementRecipient, recipientAddress);
				await user.type(elementAmount, '100');
				fireEvent.click(elementButton);

				// Assert:
				const toastElement = await screen.findByRole('alert');
				const toastProgressbar = await screen.findByRole('progressbar');

				assertToast(toastElement, toastProgressbar, $t('notification_error_unqualified_twitter_account'), 'error');
			};

			it('renders error toast when twitter account followersCount less than 10', async () => {
				const unqualifiedJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
					+ 'eyJhY2Nlc3NUb2tlbiI6ImFjY2Vzc1Rva2VuMTIzNCIsImFjY2Vzc1NlY3JldCI6ImFjY2Vzc1NlY3JldDEyMzQiLCJzY3JlZW5OYW1lIjo'
					+ 'idHdpdHRlckFjY291bnQiLCJmb2xsb3dlcnNDb3VudCI6NSwiY3JlYXRlZEF0IjoiMjAxMS0wNi0wN1QxNDoxNzo0Ni4wMDBaIiwiaWF0Ij'
					+ 'oxNjcwNzA0ODg2fQ.Y-MenesuV6tQ8arh8_3lvNG2w3lVvstc7iDYqDRwikM';

				await assertTwitterAccountToastError(unqualifiedJwtToken);
			});

			it('renders error toast when twitter account registered less than 31 days', async () => {
				const unqualifiedJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
					+ 'eyJhY2Nlc3NUb2tlbiI6ImFjY2Vzc1Rva2VuMTIzNCIsImFjY2Vzc1NlY3JldCI6ImFjY2Vzc1NlY3JldDEyMzQiLCJzY3JlZW5OYW1lIjo'
					+ 'idHdpdHRlckFjY291bnQiLCJmb2xsb3dlcnNDb3VudCI6NSwiY3JlYXRlZEF0IjoiMjAyMi0xMS0wN1QxNDoxNzo0Ni4wMDBaIiwiaWF0Ij'
					+ 'oxNjcwNzA0ODg2fQ.IJ-VgWo8KWj7FjikXH0XDnhazTRcqAkjy-jM1OEud5w';

				await assertTwitterAccountToastError(unqualifiedJwtToken);
			});

			describe('claimToken', () => {
				const createAxiosError = (code, errorMessage) => {
					return {
						response: {
							data: {
								code,
								message: errorMessage
							}
						}
					};
				};

				const assertServiceResponseErrorTests = async (serverResponse, expectResult) => {
					// Arrange:
					jest.spyOn(axios, 'post').mockRejectedValueOnce(serverResponse);

					// Act:
					render(<FaucetForm
						config={config}
						addressValidation={jest.fn(() => true)}
					/>);
					const elementRecipient = screen.getByPlaceholderText(formInputRecipient);
					const elementAmount = screen.getByPlaceholderText(formInputAmount);
					const elementButton = screen.getByText(formButtonClaim);
					await user.type(elementRecipient, recipientAddress);
					await user.type(elementAmount, '100');
					fireEvent.click(elementButton);

					// Assert:
					expect(axios.post).toHaveBeenCalledWith('/claim/url', {
						address: recipientAddress,
						amount: 100,
						twitterHandle: 'twitterAccount'
					}, {
						headers: {
							'Content-Type': 'application/json',
							'authToken': jwtToken
						}
					});

					const toastElement = await screen.findByRole('alert');
					const toastProgressbar = await screen.findByRole('progressbar');

					assertToast(toastElement, toastProgressbar, expectResult, 'error');
				};

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
					await assertServiceResponseErrorTests(
						createAxiosError('BadRequest', 'error_transaction_pending'),
						'notification_error_transaction_pending'
					);
				});

				it('renders error toast when service response notification_error_node', async () => {
					await assertServiceResponseErrorTests(createAxiosError('Internal', 'random error'), 'notification_error_node');
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
					jest.spyOn(axios, 'post').mockReturnValue({
						data: {
							transactionHash: 'transaction_hash'
						}
					});

					const amount = '100';

					// Act:
					render(<FaucetForm
						config={config}
						addressValidation={jest.fn(() => true)}
					/>);
					const elementRecipient = screen.getByPlaceholderText(formInputRecipient);
					const elementAmount = screen.getByPlaceholderText(formInputAmount);
					const elementButton = screen.getByText(formButtonClaim);
					await user.type(elementRecipient, recipientAddress);
					await user.type(elementAmount, amount);
					fireEvent.click(elementButton);

					// Assert:
					expect(axios.post).toHaveBeenCalledWith('/claim/url', {
						address: recipientAddress,
						amount: 100,
						twitterHandle: 'twitterAccount'
					}, {
						headers: {
							'Content-Type': 'application/json',
							'authToken': jwtToken
						}
					});

					const toastElements = await screen.findAllByRole('alert');
					const toastProgressbars = await screen.findAllByRole('progressbar');

					const firstToast = toastElements[0];
					const firstToastProgressbar = toastProgressbars[0];

					assertToast(firstToast, firstToastProgressbar, $t('notification_info_requested'), 'info');

					const secondToast = toastElements[1];
					const secondToastProgressbar = toastProgressbars[1];

					assertToast(secondToast, secondToastProgressbar, 'View in Explorer', 'info');
					expect(secondToast.querySelector('a')).toHaveAttribute('href', 'http://explorer.url/transaction/transaction_hash');
				});
			});
		});
	});
});
