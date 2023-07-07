const config = {
	port: process.env.PORT ?? 5002,
	twitterAppKey: process.env.TWITTER_APP_KEY,
	twitterAppSecret: process.env.TWITTER_APP_SECRET,
	jwtSecret: process.env.JWT_SECRET
};

const validateConfiguration = configParams => {
	if (!(configParams.twitterAppKey && configParams.twitterAppSecret))
		throw Error('provided twitter configuration is incomplete');

	if (!configParams.jwtSecret)
		throw Error('provided jwt configuration is incomplete');
};

module.exports = { config, validateConfiguration };
