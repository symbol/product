import TwitterSignIn from '.';
import { decrypt, encrypt } from '../../../utils/helper';
import { jest } from '@jest/globals';
import {
	fireEvent, render, screen, waitFor
} from '@testing-library/react';
import axios from 'axios';

describe('components/TwitterSignIn', () => {
	beforeEach(() => {
		jest.spyOn(axios, 'create').mockReturnValue({
			get: (url, ...params) => axios.get(url, ...params),
			defaults: {}
		});

		jest.spyOn(Storage.prototype, 'setItem');

		delete window.location;
		window.location = { assign: jest.fn() };
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// Arrange:
	const signInStatus = {
		isSignedIn: false,
		screenName: ''
	};

	const setStatus = jest.fn();
	const authUrl = 'http://auth.url';
	const aesSecret = '703453cc3a2dba8d0bed63a5757cc905ee6a6ab357caed7cdf8acdb16d9ea070';

	it('renders sign in button when isSignedIn is false', () => {
		// Arrange + Act:
		render(<TwitterSignIn
			twitterAccountStatus={signInStatus}
			setTwitterAccountStatus={setStatus}
			authUrl={authUrl}
			aesSecret={aesSecret}
		/>);

		const elementSignInButton = screen.queryByText('translated_home_form_button_auth_twitter');
		const elementSignOutButton = screen.queryByText('translated_home_form_sign_out_twitter @');

		// Assert:
		expect(elementSignInButton).toBeInTheDocument();
		expect(elementSignOutButton).not.toBeInTheDocument();
	});

	it('renders sign out button when isSignedIn is true', () => {
		// Arrange + Act:
		render(<TwitterSignIn
			twitterAccountStatus={{
				isSignedIn: true,
				screenName: 'accountName'
			}}
			setTwitterAccountStatus={setStatus}
			authUrl={authUrl}
			aesSecret={aesSecret}
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
				isSignedIn: true,
				screenName: 'accountName'
			}}
			setTwitterAccountStatus={setStatus}
			authUrl={authUrl}
			aesSecret={aesSecret}
		/>);

		// Act:
		const elementSignOutButton = screen.queryByText('translated_home_form_sign_out_twitter @accountName');
		fireEvent.click(elementSignOutButton);

		// Assert:
		expect(setStatus).toHaveBeenCalledWith({
			isSignedIn: false,
			screenName: ''
		});
		await waitFor(() => expect(sessionStorage.clear).toHaveBeenCalled());
	});

	it('clicks on twitter sign in', async () => {
		// Arrange:
		jest.spyOn(axios, 'get').mockReturnValue({
			data: {
				oauthTokenSecret: 'secret',
				url: 'called/back/url'
			}
		});

		render(<TwitterSignIn
			twitterAccountStatus={signInStatus}
			setTwitterAccountStatus={setStatus}
			authUrl={authUrl}
			aesSecret={aesSecret}
		/>);

		// Act:
		const elementSignInButton = screen.queryByText('translated_home_form_button_auth_twitter');
		fireEvent.click(elementSignInButton);

		// Assert:
		expect(axios.get).toHaveBeenCalledWith('/twitter/auth');
		expect(elementSignInButton).toBeDisabled();
		await waitFor(() => {
			// twitterOauthTokenSecret stored in encrypted format, it can't be predictable
			const encryptedValue = sessionStorage.getItem('twitterOauthTokenSecret');
			expect(sessionStorage.setItem).toHaveBeenCalledWith('twitterOauthTokenSecret', encryptedValue);
			// ensure encrypted value is correct
			expect(decrypt(encryptedValue, aesSecret)).toEqual('secret');
		});
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
				// twitterOauthTokenSecret is stored in encrypted format
				return 'twitterOauthTokenSecret' === key ? encrypt(twitterOauthTokenSecret, aesSecret) : null;
			});

			// twitter verify called back
			jest.spyOn(axios, 'get').mockReturnValueOnce({
				data: jwtAuthToken
			});

			// Act:
			render(<TwitterSignIn
				twitterAccountStatus={signInStatus}
				setTwitterAccountStatus={setStatus}
				authUrl={authUrl}
				aesSecret={aesSecret}
			/>);

			// Assert:
			expect(axios.get).toHaveBeenCalledWith('/twitter/verify', {
				params: {
					oauthToken: twitterOauthToken,
					oauthTokenSecret: twitterOauthTokenSecret,
					oauthVerifier: twitterOauthVerifier
				}
			});
			await waitFor(() => expect(sessionStorage.setItem).toHaveBeenCalledWith('authToken', jwtAuthToken));
			expect(window.location.assign).toHaveBeenCalledWith('/');
		});

		it('no action required when twitterInfo is null and query params oauth_token and oauth_verifier is missing', async () => {
			// Arrange:
			jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);

			// Act:
			render(<TwitterSignIn
				twitterAccountStatus={signInStatus}
				setTwitterAccountStatus={setStatus}
				authUrl={authUrl}
				aesSecret={aesSecret}
			/>);

			// Assert:
			expect(axios.get).not.toHaveBeenCalledWith('/twitter/verify');
			await waitFor(() => expect(sessionStorage.setItem).not.toHaveBeenCalled());
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
				authUrl={authUrl}
				aesSecret={aesSecret}
			/>);

			// Assert:
			expect(setStatus).toHaveBeenCalledWith({
				isSignedIn: true,
				screenName: 'twitterAccount'
			});
		});
	});
});
