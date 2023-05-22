const { config } = require('../config');
const { createTwitterClient, encrypt, decrypt } = require('../utils');
const jwt = require('jsonwebtoken');

const twitter = {
	/**
	 * Request oauth token from twitter
	 * @returns {Promise<{oauthToken: string, oauthTokenSecret: string, url: string}>} Oauth token info
	 */
	requestToken: async () => {
		const twitterClient = createTwitterClient();

		try {
			const {
				oauth_token, oauth_token_secret, url
			} = await twitterClient.generateAuthLink(config.twitterCallbackUrl);
			return {
				oauthToken: oauth_token,
				oauthTokenSecret: encrypt(oauth_token_secret),
				url
			};
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			throw Error('fail to request twitter token');
		}
	},
	/**
	 * Get user's twitter information
	 * @param {string} oauthToken user's twitter oauth token
	 * @param {string} oauthTokenSecret encrypted oauth token secret
	 * @param {string} oauthVerifier user's twitter oauth verifier
	 * @returns {Promise<string>} signed jwt token
	 */
	userAccess: async ({ oauthToken, oauthTokenSecret, oauthVerifier }) => {
		try {
			const twitterClient = createTwitterClient({
				accessToken: oauthToken,
				accessSecret: decrypt(oauthTokenSecret)
			});

			const {
				client, screenName, accessToken, accessSecret
			} = await twitterClient.login(oauthVerifier);

			const { data } = await client.v2.me({ 'user.fields': ['created_at', 'public_metrics'] });

			const jwtToken = jwt.sign({
				accessToken,
				accessSecret,
				screenName,
				followersCount: data.public_metrics.followers_count,
				createdAt: new Date(data.created_at)
			}, config.jwtSecret);

			return jwtToken;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			throw Error('fail to request user access token');
		}
	}
};

module.exports = twitter;
