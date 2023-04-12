import TwitterSignIn from '.';
import {
	fireEvent, render, screen, waitFor
} from '@testing-library/react';
import mockAxios from 'axios';

describe('components/TwitterSignIn', () => {
	beforeEach(() => {
		jest.spyOn(Storage.prototype, 'setItem');

		delete window.location;
		window.location = { assign: jest.fn() };
	});

	// Arrange:
	const signInStatus = {
		isSignIn: false,
		screenName: ''
	};

	const setStatus = jest.fn();

	it('renders sign in button when isSignIn is false', () => {
		// Arrange + Act:
		render(<TwitterSignIn
			twitterAccountStatus={signInStatus}
			setTwitterAccountStatus={setStatus}
		/>);

		const elementSignInButton = screen.queryByText('translated_home_form_button_auth_twitter');
		const elementSignOutButton = screen.queryByText('translated_home_form_sign_out_twitter @');

		// Assert:
		expect(elementSignInButton).toBeInTheDocument();
		expect(elementSignOutButton).not.toBeInTheDocument();
	});

	it('renders sign out button when isSignIn is true', () => {
		// Arrange + Act:
		render(<TwitterSignIn
			twitterAccountStatus={{
				isSignIn: true,
				screenName: 'accountName'
			}}
			setTwitterAccountStatus={setStatus}
		/>);

		const elementSignInButton = screen.queryByText('translated_home_form_button_auth_twitter');
		const elementSignOutButton = screen.queryByText('translated_home_form_sign_out_twitter @accountName');

		// Assert:
		expect(elementSignInButton).not.toBeInTheDocument();
		expect(elementSignOutButton).toBeInTheDocument();
	});

	it('clicks on twitter logout', async () => {
		// Arrange:
		jest.spyOn(Storage.prototype, 'clear');

		render(<TwitterSignIn
			twitterAccountStatus={{
				isSignIn: true,
				screenName: 'accountName'
			}}
			setTwitterAccountStatus={setStatus}
		/>);

		// Act:
		const elementSignOutButton = screen.queryByText('translated_home_form_sign_out_twitter @accountName');
		fireEvent.click(elementSignOutButton);

		// Assert:
		expect(setStatus).toHaveBeenCalledWith({
			isSignIn: false,
			screenName: ''
		});
		await waitFor(() => expect(localStorage.clear).toHaveBeenCalled());
	});

	it('clicks on twitter sign in', async () => {
		// Arrange:
		mockAxios.get.mockReturnValue({
			data: {
				oauthTokenSecret: 'secret',
				url: 'called/back/url'
			}
		});

		render(<TwitterSignIn
			twitterAccountStatus={signInStatus}
			setTwitterAccountStatus={setStatus}
		/>);

		// Act:
		const elementSignInButton = screen.queryByText('translated_home_form_button_auth_twitter');
		fireEvent.click(elementSignInButton);

		// Assert:
		expect(mockAxios.get).toHaveBeenCalledWith('/twitter/auth');
		expect(elementSignInButton).toBeDisabled();
		await waitFor(() => expect(localStorage.setItem).toHaveBeenCalledWith('twitterOauthTokenSecret', 'secret'));
		expect(window.location.assign).toHaveBeenCalledWith('called/back/url');
	});

	describe('useEffect', () => {
		// Arrange:

		// decoded jwt payload
		// {
		// 	"accessToken": "accessToken1234",
		// 	"accessSecret": "accessSecret1234",
		// 	"screenName": "twitterAccount",
		// 	"followersCount": 100,
		// 	"createdAt": "2011-06-07T14:17:46.000Z",
		// 	"iat": 1670704886
		// }
		const jwtAuthToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
		+ 'eyJhY2Nlc3NUb2tlbiI6ImFjY2Vzc1Rva2VuMTIzNCIsImFjY2Vzc1NlY3JldCI6ImFjY2Vzc1NlY3JldDEyMzQiLCJzY3JlZW5OYW1lIjo'
		+ 'idHdpdHRlckFjY291bnQiLCJmb2xsb3dlcnNDb3VudCI6MTAwLCJjcmVhdGVkQXQiOiIyMDExLTA2LTA3VDE0OjE3OjQ2LjAwMFoiLCJpYX'
		+ 'QiOjE2NzA3MDQ4ODZ9.PDZOY7EXRr_qknErLfqXqymJ8Ivg4nNiSFvJBSG56f0';

		it('verify twitter when called back url contains oauth_token and oauth_verifier params', async () => {
			// Arrange:
			const twitterOauthTokenSecret = 'oauthTokenSecret1234';
			const twitterOauthToken = 'oauthToken1234';
			const twitterOauthVerifier = 'oauthVerifier1234';

			const location = {
				...window.location,
				search: `?oauth_token=${twitterOauthToken}&oauth_verifier=${twitterOauthVerifier}`
			};

			Object.defineProperty(window, 'location', {
				writable: true,
				value: location
			});

			jest.spyOn(Storage.prototype, 'getItem').mockImplementation(key => {
				return 'twitterOauthTokenSecret' === key ? twitterOauthTokenSecret : null;
			});

			// twitter verify called back
			mockAxios.get.mockReturnValueOnce({
				data: jwtAuthToken
			});

			// Act:
			render(<TwitterSignIn
				twitterAccountStatus={signInStatus}
				setTwitterAccountStatus={setStatus}
			/>);

			// Assert:
			expect(mockAxios.get).toHaveBeenCalledWith('/twitter/verify', {
				params: {
					oauthToken: twitterOauthToken,
					oauthTokenSecret: twitterOauthTokenSecret,
					oauthVerifier: twitterOauthVerifier
				}
			});
			await waitFor(() => expect(localStorage.setItem).toHaveBeenCalledWith('authToken', jwtAuthToken));
			expect(window.location.assign).toHaveBeenCalledWith('/');
		});

		it('no action required when twitterInfo is null and query params oauth_token and oauth_verifier is missing', async () => {
			// Arrange:
			jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);

			// Act:
			render(<TwitterSignIn
				twitterAccountStatus={signInStatus}
				setTwitterAccountStatus={setStatus}
			/>);

			// Assert:
			expect(mockAxios.get).not.toHaveBeenCalledWith('/twitter/verify');
			await waitFor(() => expect(localStorage.setItem).not.toHaveBeenCalled());
			expect(window.location.assign).not.toHaveBeenCalled();
			expect(setStatus).not.toHaveBeenCalled();
		});

		it('set twitter account status after twitter verify successfully', () => {
			// Arrange:
			jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => jwtAuthToken);

			// Act:
			render(<TwitterSignIn
				twitterAccountStatus={signInStatus}
				setTwitterAccountStatus={setStatus}
			/>);

			// Assert:
			expect(setStatus).toHaveBeenCalledWith({
				isSignIn: true,
				screenName: 'twitterAccount'
			});
		});
	});
});
