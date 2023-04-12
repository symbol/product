/* eslint-disable testing-library/no-node-access */
import Home from '.';
import * as styles from '../../../common/utils/styles';
import {
	fireEvent, render, screen, waitFor, act
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
		const buttonAuthText = $t('home_form_button_auth_twitter');

		// Act:
		render(<Home />);
		const elementButtonAuth = screen.queryByText(buttonAuthText);

		// Assert:
		expect(elementButtonAuth).not.toBeInTheDocument();
	});

	describe('toast', () => {
		// Arrange:
		const formInputRecipient = $t('home_form_input_recipient_placeholder', { char: 'T' });
		const formInputAmount = $t('home_form_input_amount_placeholder', {
			currency: 'XYM',
			maxAmount: '500'
		});
		const formButton = $t('home_form_button_claim_text');

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
				expect(toast.error).toHaveBeenCalledWith($t(expectedErrorMessage));
			});
		};

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
			expect(toast.error).toHaveBeenCalledWith($t('notification_error_unqualified_twitter_account'));
		};

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
			expect(toast.info).toHaveBeenCalledWith($t('notification_info_requested', {
				amount,
				currency: 'XYM',
				address: recipientAddress
			}));
		});

		runBasicErrorToastTests(
			'address',
			{
				address: 'ABHGLHFK4FQUDQS3XBYKTQ3CMZLA227W5WPVAKPZ',
				amount: '100'
			},
			'notification_error_invalid_address'
		);

		runBasicErrorToastTests(
			'amount',
			{
				address: recipientAddress,
				amount: '-100'
			},
			'notification_error_invalid_amount'
		);
		// eslint-disable-next-line max-len
		it('renders error toast when twitter account followersCount less than 10', () => assertTwitterAccountToastError('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NUb2tlbiI6ImFjY2Vzc1Rva2VuMTIzNCIsImFjY2Vzc1NlY3JldCI6ImFjY2Vzc1NlY3JldDEyMzQiLCJzY3JlZW5OYW1lIjoidHdpdHRlckFjY291bnQiLCJmb2xsb3dlcnNDb3VudCI6NSwiY3JlYXRlZEF0IjoiMjAxMS0wNi0wN1QxNDoxNzo0Ni4wMDBaIiwiaWF0IjoxNjcwNzA0ODg2fQ.Y-MenesuV6tQ8arh8_3lvNG2w3lVvstc7iDYqDRwikM'));
		// eslint-disable-next-line max-len
		it('renders error toast when twitter account registered less than 31 days', () => assertTwitterAccountToastError('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NUb2tlbiI6ImFjY2Vzc1Rva2VuMTIzNCIsImFjY2Vzc1NlY3JldCI6ImFjY2Vzc1NlY3JldDEyMzQiLCJzY3JlZW5OYW1lIjoidHdpdHRlckFjY291bnQiLCJmb2xsb3dlcnNDb3VudCI6NSwiY3JlYXRlZEF0IjoiMjAyMi0xMS0wN1QxNDoxNzo0Ni4wMDBaIiwiaWF0IjoxNjcwNzA0ODg2fQ.IJ-VgWo8KWj7FjikXH0XDnhazTRcqAkjy-jM1OEud5w'));
	});

	describe('screen breakpoint', () => {
		const runBasicResizeBreakpointTests = (isPortrait, className, expectedResult) => {
			it(`renders page in ${isPortrait ? 'portrait' : 'landscape' } orientation
				with the class name when portrait boolean is ${isPortrait}`, async () => {
				// Arrange:
				mockResizeObserverAndGetBreakpoint(isPortrait, className);

				// Act:
				render(<Home />);

				// Assert:
				await waitFor(() => expect(screen.getByTestId('home-page-content').classList).toContain(expectedResult));
				expect(document.documentElement.classList).toContain(className);
			});
		};

		runBasicResizeBreakpointTests(true, 'breakpoint-class-1', 'page-container-portrait');
		runBasicResizeBreakpointTests(false, 'breakpoint-class-2', 'page-container-landscape');

		describe('background art', () => {
			const renderBgContainerWithResize = (height, width) => {
				// Arrange:
				window.ResizeObserver = jest.fn(callback => ({
					observe: jest.fn(),
					disconnect: jest.fn()
				}));

				render(<Home />);

				const artContainerRef = screen.getByTestId('art-container');

				// Act:
				act(() => {
					const resizeCallback = window.ResizeObserver.mock.calls[0][0];
					resizeCallback([{
						target: artContainerRef,
						contentRect: {
							height,
							width
						}
					}]);
				});
			};

			it('renders art when aspect ratio is less than 5', async () => {
				// Arrange + Act:
				renderBgContainerWithResize(100, 25);

				// Assert:
				const divBgImageLeft = screen.getByTestId('bg-image-left');
				const divBgImageRight = screen.getByTestId('bg-image-right');

				const divBgImageMobileLeft = screen.queryByTestId('bg-image-mobile-left');
				const divBgImageMobileRight = screen.queryByTestId('bg-image-mobile-right');

				expect(divBgImageLeft).toBeInTheDocument();
				expect(divBgImageRight).toBeInTheDocument();
				expect(divBgImageMobileLeft).not.toBeInTheDocument();
				expect(divBgImageMobileRight).not.toBeInTheDocument();
			});

			it('renders art in mobile when aspect ratio is between 5 and 15', async () => {
				// Arrange + Act:
				renderBgContainerWithResize(100, 10);

				// Assert:
				const divBgImageLeft = screen.queryByTestId('bg-image-left');
				const divBgImageRight = screen.queryByTestId('bg-image-right');

				const divBgImageMobileLeft = screen.getByTestId('bg-image-mobile-left');
				const divBgImageMobileRight = screen.getByTestId('bg-image-mobile-right');

				expect(divBgImageLeft).not.toBeInTheDocument();
				expect(divBgImageRight).not.toBeInTheDocument();
				expect(divBgImageMobileLeft).toBeInTheDocument();
				expect(divBgImageMobileRight).toBeInTheDocument();
			});

			it('renders nothing when aspect ratio is more than 15', async () => {
				// Arrange + Act:
				renderBgContainerWithResize(100, 6);

				// Assert:
				const divBgImageLeft = screen.queryByTestId('bg-image-left');
				const divBgImageRight = screen.queryByTestId('bg-image-right');

				const divBgImageMobileLeft = screen.queryByTestId('bg-image-mobile-left');
				const divBgImageMobileRight = screen.queryByTestId('bg-image-mobile-right');

				expect(divBgImageLeft).not.toBeInTheDocument();
				expect(divBgImageRight).not.toBeInTheDocument();
				expect(divBgImageMobileLeft).not.toBeInTheDocument();
				expect(divBgImageMobileRight).not.toBeInTheDocument();
			});
		});
	});
});
