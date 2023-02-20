import registerFaucet from '../../src/routers/index.js';
import { expect } from 'chai';

describe('routers', () => {
	describe('registerFaucet', () => {
		const createMockServer = routes => ({
			post: route => routes.push(route)
		});

		it('registers all routes ', () => {
			// Arrange:
			const routes = [];

			const server = createMockServer(routes);

			// Act:
			registerFaucet.register(server);

			// Assert:
			expect(routes).to.be.deep.equal([
				'/claim/xem',
				'/claim/xym'
			]);
		});
	});
});
