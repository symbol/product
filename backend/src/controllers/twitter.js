const createTwitterClient = require('../utils/createTwitterClient');
const dotenv = require('dotenv');

dotenv.config();
const twitterCallback = process.env.TWITTER_CALLBACK_URL;

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
			} = await twitterClient.generateAuthLink(twitterCallback);
			return {
				oauthToken: oauth_token,
				oauthTokenSecret: oauth_token_secret,
				url
			};
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			throw Error('fail to request twitter token');
		}
	},
	/* eslint-disable */
	/**
	 * Get user's twitter information
	 * @param {string} oauthToken user's twitter oauth token
	 * @param {string} oauthTokenSecret user's twitter oauth token secret
	 * @param {string} oauthVerifier user's twitter oauth verifier
	 * @returns {Promise<{accessToken: string, accessSecret:string, screenName: string, followersCount: number, createdAt: Date}>} user's twitter account information
	 */
	/* eslint-enable */
	userAccess: async ({ oauthToken, oauthTokenSecret, oauthVerifier }) => {
		const twitterClient = createTwitterClient({
			accessToken: oauthToken,
			accessSecret: oauthTokenSecret
		});

		try {
			const {
				client, screenName, accessToken, accessSecret
			} = await twitterClient.login(oauthVerifier);

			const { data } = await client.v2.me({ 'user.fields': ['created_at', 'public_metrics'] });

			return {
				accessToken,
				accessSecret,
				screenName,
				followersCount: data.public_metrics.followers_count,
				createdAt: new Date(data.created_at)
			};
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			throw Error('fail to request user access token');
		}
	}
};

module.exports = twitter;
