import nemRoute from './nemRoute.js';
import symbolRoute from './symbolRoute.js';

const registerFaucet = {
	register: (server, claimDatabase) => {
		const allRoutes = [
			nemRoute,
			symbolRoute
		];

		allRoutes.forEach(routes => {
			routes.register(server, claimDatabase);
		});
	}
};

export default registerFaucet;
