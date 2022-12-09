const { TwitterApi } = require('twitter-api-v2');

/**
 * Create twitter api client
 * @param {{appKey: string, appSecret: string, accessToken: string, accessSecret: string}} config twitter API credentials
 * @returns {TwitterApi} twitter API
 */
const createTwitterClient = config => new TwitterApi({
	appKey: process.env.TWITTER_APP_KEY,
	appSecret: process.env.TWITTER_APP_SECRET,
	...config
});

module.exports = createTwitterClient;
