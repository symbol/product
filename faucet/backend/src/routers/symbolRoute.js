import routeUtils from './routeUtils.js';
import symbolFacade from '../facade/symbolFacade.js';

const symbolRoute = {
	register: (server, claimDatabase, authentication) => {
		server.post('/claim/xym', authentication, (req, res, next) => {
			routeUtils.claimRoute(req, res, next, symbolFacade).then(result => {
				if (result) {
					const { address, amount, twitterHandle } = result;

					// Add claimed record into database
					claimDatabase.insertClaimed({
						address,
						amount,
						twitterHandle,
						protocol: 'Symbol'
					});
				}
			});
		});

		server.get('/config/xym', (req, res, next) => {
			routeUtils.configAndBalanceRoute(res, next, symbolFacade);
		});
	}
};

export default symbolRoute;
