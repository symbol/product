const { config, validateConfiguration } = require('./config');
const faucetRoute = require('./routers');
const { checkTwitterAccount } = require('./utils/helper');
const { version } = require('../package');
const { verify } = require('jsonwebtoken');
const restify = require('restify');
const restifyErrors = require('restify-errors');

const server = restify.createServer({
	name: 'Faucet Backend Service',
	version
});

server.use(restify.plugins.acceptParser('application/json'));
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.queryParser({ mapParams: true }));

const authentication = (req, res, next) => {
	const authToken = req.header('authToken');

	try {
		const { createdAt, followersCount } = verify(authToken, config.jwtSecret);

		if (checkTwitterAccount(createdAt, followersCount))
			next();
		else
			next(new restifyErrors.ForbiddenError('Twitter requirement fail'));
	} catch (error) {
		next(new restifyErrors.ForbiddenError('Authentication fail'));
	}
};

// Middleware
server.use(authentication);

// Setup cross domain access
server.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	res.header('Access-Control-Allow-Methods', 'POST, GET');
	next();
});

validateConfiguration(config);

// Setup Route
faucetRoute(server);

server.listen(config.port, () => {
	// eslint-disable-next-line no-console
	console.info('%s listening at %s', server.name, server.url);
});

module.exports = server;
