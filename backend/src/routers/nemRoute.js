import routeUtils from './routeUtils.js';
import nemFacade from '../facade/nemFacade.js';

const nemRoute = {
	register: (server, claimDatabase, authentication) => {
		server.post('/claim/xem', authentication, (req, res, next) => {
			routeUtils.claimRoute(req, res, next, nemFacade).then(result => {
				if (result) {
					const { address, amount, twitterHandle } = result;

					// Add claimed record into database
					claimDatabase.insertClaimed({
						address,
						amount,
						twitterHandle,
						protocol: 'NEM'
					});
				}
			});
		});

		server.get('/config/xem', (req, res, next) => {
			routeUtils.configAndBalanceRoute(res, next, nemFacade);
		});
	}
};

export default nemRoute;
