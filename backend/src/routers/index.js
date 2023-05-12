import nemRoute from './nemRoute.js';
import symbolRoute from './symbolRoute.js';

const registerFaucet = {
	register: (server, claimDatabase, authentication) => {
		const allRoutes = [
			nemRoute,
			symbolRoute
		];

		allRoutes.forEach(routes => {
			routes.register(server, claimDatabase, authentication);
		});
	}
};

export default registerFaucet;
