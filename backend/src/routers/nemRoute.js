import routeUtils from './routeUtils.js';
import nemFacade from '../facade/nemFacade.js';

const nemRoute = {
	register: server => {
		server.post('/claim/xem', (req, res, next) => {
			routeUtils.claimRoute(req, res, next, nemFacade);
		});
	}
};

export default nemRoute;
