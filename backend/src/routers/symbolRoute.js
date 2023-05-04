import routeUtils from './routeUtils.js';
import symbolFacade from '../facade/symbolFacade.js';

const symbolRoute = {
	register: (server, claimDatabase) => {
		server.post('/claim/xym', (req, res, next) => {
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
	}
};

export default symbolRoute;
