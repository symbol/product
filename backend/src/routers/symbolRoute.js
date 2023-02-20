import routeUtils from './routeUtils.js';
import symbolFacade from '../facade/symbolFacade.js';

const symbolRoute = {
	register: server => {
		server.post('/claim/xym', (req, res, next) => {
			routeUtils.claimRoute(req, res, next, symbolFacade);
		});
	}
};

export default symbolRoute;
