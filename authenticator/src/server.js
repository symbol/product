const { config, validateConfiguration } = require('./config');
const twitterRoute = require('./routers');
const { version } = require('../package');
const restify = require('restify');

const server = restify.createServer({
	name: 'Twitter Auth Service',
	version
});

server.use(restify.plugins.acceptParser('application/json'));
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.queryParser({ mapParams: true }));

// Setup cross domain access
server.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	res.header('Access-Control-Allow-Methods', 'GET');
	next();
});

validateConfiguration(config);

// Setup Route
twitterRoute(server);

server.listen(config.port, () => {
	// eslint-disable-next-line no-console
	console.info('%s listening at %s', server.name, server.url);
});

module.exports = server;
