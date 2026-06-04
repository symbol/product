const twitterController = require('../controllers');

const twitterRoute = server => {
	server.get('/twitter/auth', async request => {
		const { redirectUrl } = request.query;
		const { oauthTokenSecret, url } = await twitterController.requestToken(redirectUrl);

		return {
			oauthTokenSecret,
			url
		};
	});

	server.get('/twitter/verify', async request => twitterController.userAccess(request.query));
};

module.exports = twitterRoute;
