import { $t } from '../../i18n';
import Button from '../Button';
import axios from 'axios';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import { decode } from 'jsonwebtoken'
import Config from '../../config'

const authRequest = axios.create({
	baseURL: Config.AUTH_URL
});

const TwitterSignIn = function ({
	twitterAccountStatus,
	setTwitterAccountStatus
}) {
	const [isLoading, setIsLoading] = useState(false);

	const twitterAuth = async () => {
		setIsLoading(true);

		const { data } = await authRequest.get('/twitter/auth');

		localStorage.setItem('twitterOauthTokenSecret', data.oauthTokenSecret);

		window.location.assign(data.url);
	};

	const twitterLogout = () => {
		localStorage.clear();
		setTwitterAccountStatus({
			isSignIn: false,
			screenName: ''
		});
	};

	useEffect(() => {
		const twitterInfo = decode(localStorage.getItem('authToken'));

		const query = new URLSearchParams(window.location.search);
		const oauthToken = query.get('oauth_token');
		const oauthVerifier = query.get('oauth_verifier');

		const twitterVerify = async () => {
			const oauthTokenSecret = localStorage.getItem('twitterOauthTokenSecret');

			const { data } = await authRequest.get('/twitter/verify', {
				params: {
					oauthToken,
					oauthTokenSecret,
					oauthVerifier
				}
			});

			if (data) {
				localStorage.setItem('authToken', data);
				window.location.assign('/');
			}
		};

		// To verify account when twitter auth called back
		if (null !== oauthToken && null !== oauthVerifier)
			twitterVerify(oauthToken, oauthVerifier);

		// set sign in after verify successful
		if (null !== twitterInfo) {
			setTwitterAccountStatus({
				isSignIn: true,
				screenName: twitterInfo.screenName
			});
		}
		// eslint-disable-next-line
	}, []);

	return (
		<div>
			{
				twitterAccountStatus.isSignIn
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
		isSignIn: PropTypes.bool.isRequired,
		screenName: PropTypes.string.isRequired
	}).isRequired,
	setTwitterAccountStatus: PropTypes.func.isRequired
};

export default TwitterSignIn;
