const config = {
	port: process.env.PORT ?? 5002,
	twitterAppKey: process.env.TWITTER_APP_KEY,
	twitterAppSecret: process.env.TWITTER_APP_SECRET,
	twitterCallbackUrl: process.env.TWITTER_CALLBACK_URL,
	jwtSecret: process.env.JWT_SECRET
};

const validateConfiguration = configParams => {
	if (!(configParams.twitterAppKey && configParams.twitterAppSecret && configParams.twitterCallbackUrl))
		throw Error('provided twitter configuration is incomplete');

	if (!configParams.jwtSecret)
		throw Error('provided jwt configuration is incomplete');
};

module.exports = { config, validateConfiguration };
