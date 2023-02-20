import nemRoute from './nemRoute.js';
import symbolRoute from './symbolRoute.js';

const registerFaucet = {
	register: server => {
		const allRoutes = [
			nemRoute,
			symbolRoute
		];

		allRoutes.forEach(routes => {
			routes.register(server);
		});
	}
};

export default registerFaucet;
