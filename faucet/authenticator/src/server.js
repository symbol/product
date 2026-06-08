const { config, validateConfiguration } = require('./config');
const twitterRoute = require('./routers');
const { version } = require('../package');
const cors = require('@fastify/cors');
const fastify = require('fastify');

const createServer = () => {
	const server = fastify({
		logger: false
	});

	server.register(cors, {
		origin: '*',
		methods: ['GET'],
		allowedHeaders: ['Content-Type']
	});

	validateConfiguration(config);

	// Setup Route
	twitterRoute(server);

	return server;
};

const server = createServer();

server.listen({
	port: config.port,
	host: '0.0.0.0'
}).then(address => {
	// eslint-disable-next-line no-console
	console.info('Twitter Auth Service v%s listening at %s', version, address);
});

module.exports = createServer;
