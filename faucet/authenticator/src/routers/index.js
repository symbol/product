const twitterController = require('../controllers');

const handleRoute = async (res, next, handler) => {
	try {
		const result = await handler();

		if (result instanceof Error)
			return next(result);

		res.send(result);
		return next(false);
	} catch (error) {
		return next(error);
	}
};

const twitterRoute = server => {
	server.get('/twitter/auth', (req, res, next) => {
		const handler = async () => {
			const { oauthTokenSecret, url } = await twitterController.requestToken();

			return {
				oauthTokenSecret,
				url
			};
		};

		handleRoute(res, next, handler);
	});

	server.get('/twitter/verify', (req, res, next) => {
		const handler = async () => twitterController.userAccess(req.params);

		handleRoute(res, next, handler);
	});
};

module.exports = twitterRoute;
