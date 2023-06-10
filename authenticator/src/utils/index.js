const { config } = require('../config');
const { TwitterApi } = require('twitter-api-v2');

/**
 * Create twitter api client
 * @param {{appKey: string, appSecret: string, accessToken: string, accessSecret: string}} customConfig twitter API credentials
 * @returns {TwitterApi} twitter API
 */
const createTwitterClient = customConfig => new TwitterApi({
	appKey: config.twitterAppKey,
	appSecret: config.twitterAppSecret,
	...customConfig
});

module.exports = createTwitterClient;
