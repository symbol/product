import { config, validateConfiguration } from './config/index.js';
import ClaimDatabase from './database/ClaimDatabase.js';
import DatabaseConnection from './database/DatabaseConnection.js';
import logger from './logger.js';
import registerFaucet from './routers/index.js';
import helper from './utils/helper.js';
import jwt from 'jsonwebtoken';
import restify from 'restify';
import restifyErrors from 'restify-errors';

const createRestifyServer = db => {
	const server = restify.createServer({
		name: 'Faucet Backend Service',
		version: '1.0.0'
	});

	// Setup cross domain access
	server.pre((req, res, next) => {
		if ('OPTIONS' !== req.method)
			return next();

		res.header('access-control-allow-origin', '*');
		res.header('access-control-allow-methods', 'POST, OPTIONS');
		res.header('access-control-allow-headers', 'Content-Type, authToken');

		return res.send(204);
	});

	server.use((req, res, next) => {
		res.header('access-control-allow-origin', '*');
		res.header('vary', 'origin');
		return next();
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
				next(new restifyErrors.ForbiddenError('error_twitter_requirement_fail'));
		} catch (error) {
			next(new restifyErrors.ForbiddenError('error_authentication_fail'));
		}
	};

	// Middleware
	server.use(authentication);

	validateConfiguration(config);

	// Setup Route
	registerFaucet.register(server, db);

	return server;
};

// Setup Database
const databaseConnection = new DatabaseConnection(`${config.dbPath}`);
const claimDatabase = new ClaimDatabase(databaseConnection.connection);

claimDatabase.createTable();

// Setup Restify Server
const restifyServer = createRestifyServer(claimDatabase);

restifyServer.listen(config.port, () => {
	logger.info(`${restifyServer.name} listening at ${restifyServer.url}`);
});

// Close connection for restifyServer and database
process.on('SIGINT', () => {
	restifyServer.close();
	databaseConnection.close();
});

export default createRestifyServer;
