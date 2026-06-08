import routeUtils from './routeUtils.js';
import symbolFacade from '../facade/symbolFacade.js';

const symbolRoute = {
	register: (server, claimDatabase, authentication) => {
		server.post('/claim/xym', { preHandler: authentication }, async request => {
			const { response, claimRecord } = await routeUtils.claimRoute(request, symbolFacade);

			// Add claimed record into database
			await claimDatabase.insertClaimed({
				...claimRecord,
				protocol: 'Symbol'
			});

			return response;
		});

		server.get('/config/xym', async () => routeUtils.configAndBalanceRoute(symbolFacade));
	}
};

export default symbolRoute;
