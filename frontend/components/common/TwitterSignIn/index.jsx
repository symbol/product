import Button from '../Button';
import axios from 'axios';
import { decode } from 'jsonwebtoken';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

const TwitterSignIn = function ({
	twitterAccountStatus,
	setTwitterAccountStatus,
	authUrl
}) {
	const [isLoading, setIsLoading] = useState(false);

	const authRequest = axios.create();
	authRequest.defaults.baseURL = authUrl;

	const twitterAuth = async () => {
		setIsLoading(true);
		const { data } = await authRequest.get('/twitter/auth');
		sessionStorage.setItem('twitterOauthTokenSecret', data.oauthTokenSecret);
		window.location.assign(data.url);
	};

	const twitterLogout = () => {
		sessionStorage.clear();
		setTwitterAccountStatus({
			isSignedIn: false,
			screenName: ''
		});
	};

	useEffect(() => {
		const twitterInfo = decode(sessionStorage.getItem('authToken'));

		const query = new URLSearchParams(window.location.search);
		const oauthToken = query.get('oauth_token');
		const oauthVerifier = query.get('oauth_verifier');

		const twitterVerify = async () => {
			const oauthTokenSecret = sessionStorage.getItem('twitterOauthTokenSecret');

			const { data } = await authRequest.get('/twitter/verify', {
				params: {
					oauthToken,
					oauthTokenSecret,
					oauthVerifier
				}
			});

			if (data) {
				sessionStorage.setItem('authToken', data);
				window.location.assign('/');
			}
		};

		// To verify account when twitter auth called back
		if (null !== oauthToken && null !== oauthVerifier)
			twitterVerify(oauthToken, oauthVerifier);

		// set sign in after verify successful
		if (null !== twitterInfo) {
			setTwitterAccountStatus({
				isSignedIn: true,
				screenName: twitterInfo.screenName
			});
		}
		// eslint-disable-next-line
	}, []);

	return (
		<div>
			{
				twitterAccountStatus.isSignedIn
					? (
						<Button type="button" onClick={twitterLogout}>
							{`${$t('home_form_sign_out_twitter')} @${twitterAccountStatus.screenName}`}
						</Button>
					)
					: <Button type="button" onClick={twitterAuth} isLoading={isLoading}>{$t('home_form_button_auth_twitter')}</Button>
			}
		</div>
	);
};

TwitterSignIn.propTypes = {
	twitterAccountStatus: PropTypes.exact({
		isSignedIn: PropTypes.bool.isRequired,
		screenName: PropTypes.string.isRequired
	}).isRequired,
	setTwitterAccountStatus: PropTypes.func.isRequired
};

export default TwitterSignIn;
