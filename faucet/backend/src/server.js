import { config, validateConfiguration } from './config/index.js';
import ClaimDatabase from './database/ClaimDatabase.js';
import DatabaseConnection from './database/DatabaseConnection.js';
import HttpError from './errors/httpError.js';
import logger from './logger.js';
import registerFaucet from './routers/index.js';
import helper from './utils/helper.js';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';

const createFastifyServer = db => {
	const server = Fastify({
		logger: false
	});

	server.register(cors, {
		origin: '*',
		methods: ['POST', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'authToken'],
		strictPreflight: false
	});

	validateConfiguration(config);

	const authentication = async request => {
		const authToken = request.headers.authtoken;

		try {
			const { createdAt, followersCount } = jwt.verify(authToken, config.jwtSecret);

			if (!helper.checkTwitterAccount(createdAt, followersCount))
				throw new HttpError(403, 'Forbidden', 'error_twitter_requirement_fail');
		} catch (error) {
			if (error instanceof HttpError)
				throw error;

			throw new HttpError(403, 'Forbidden', 'error_authentication_fail');
		}
	};

	server.setErrorHandler((error, request, reply) => {
		if (error.statusCode && error.code)
			reply.code(error.statusCode).send({ code: error.code, message: error.message });
		else
			reply.code(error.statusCode || 500).send({ code: 'Internal', message: error.message });
	});

	// Setup Route + Middleware
	registerFaucet.register(server, db, authentication);

	return server;
};

const start = async () => {
	// Setup Database
	const databaseConnection = new DatabaseConnection(`${config.dbPath}`);
	const claimDatabase = new ClaimDatabase(databaseConnection.connection);

	await claimDatabase.createTable();

	// Setup Fastify Server
	const fastifyServer = createFastifyServer(claimDatabase);
	await fastifyServer.listen({ port: config.port, host: '0.0.0.0' });

	logger.info(`Faucet Backend Service listening at ${fastifyServer.server.address().address}:${fastifyServer.server.address().port}`);

	// Close connection for fastifyServer and database
	process.on('SIGINT', async () => {
		await fastifyServer.close();
		databaseConnection.close();
	});
};

start();

export default createFastifyServer;
