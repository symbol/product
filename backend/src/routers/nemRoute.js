import routeUtils from './routeUtils.js';
import nemFacade from '../facade/nemFacade.js';

const nemRoute = {
	register: (server, claimDatabase) => {
		server.post('/claim/xem', (req, res, next) => {
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
	}
};

export default nemRoute;
