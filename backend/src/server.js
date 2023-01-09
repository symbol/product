import { config, validateConfiguration } from './config/index.js';
import faucetRoute from './routers/index.js';
import helper from './utils/helper.js';
import jwt from 'jsonwebtoken';
import restify from 'restify';
import restifyErrors from 'restify-errors';

const server = restify.createServer({
	name: 'Faucet Backend Service',
	version: '1.0.0'
});

server.use(restify.plugins.acceptParser('application/json'));
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.queryParser({ mapParams: true }));

const authentication = (req, res, next) => {
	const authToken = req.header('authToken');

	try {
		const { createdAt, followersCount } = jwt.verify(authToken, config.jwtSecret);

		if (helper.checkTwitterAccount(createdAt, followersCount))
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

export default server;
