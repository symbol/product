import routeUtils from './routeUtils.js';
import nemFacade from '../facade/nemFacade.js';

const nemRoute = {
	register: (server, claimDatabase, authentication) => {
		server.post('/claim/xem', { preHandler: authentication }, async request => {
			const { response, claimRecord } = await routeUtils.claimRoute(request, nemFacade);

			// Add claimed record into database
			await claimDatabase.insertClaimed({
				...claimRecord,
				protocol: 'NEM'
			});

			return response;
		});

		server.get('/config/xem', async () => routeUtils.configAndBalanceRoute(nemFacade));
	}
};

export default nemRoute;
