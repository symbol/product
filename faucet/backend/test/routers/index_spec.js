import registerFaucet from '../../src/routers/index.js';
import { expect } from 'chai';

describe('routers', () => {
	describe('registerFaucet', () => {
		const createCapturingMockServer = (captureMethod, routes) => {
			const server = {};
			['get', 'post'].forEach(method => {
				server[method] = () => {};
			});

			server[captureMethod] = route => routes.push(route);
			return server;
		};

		const runBasicRouteTests = (method, expectedResult) => {
			it(`registers all ${method} routes`, () => {
				// Arrange:
				const routes = [];
				const claimDatabase = {};
				const authentication = {};

				const server = createCapturingMockServer(method, routes);

				// Act:
				registerFaucet.register(server, claimDatabase, authentication);

				// Assert:
				expect(routes).to.deep.equal(expectedResult);
			});
		};

		runBasicRouteTests('get', [
			'/config/xem',
			'/config/xym'
		]);

		runBasicRouteTests('post', [
			'/claim/xem',
			'/claim/xym'
		]);
	});
});
