import { Api } from '../../src/api';
import { expect, jest } from '@jest/globals';

describe('api/index.js Api aggregator', () => {
	it('constructs and exposes every service instance on the api object', () => {
		// Arrange:
		const makeRequest = jest.fn(async () => ({}));
		const config = {
			marketDataURL: 'https://example.market',
			marketCurrencies: ['USD'],
			nodewatchURL: { testnet: 'https://nodewatch.example' }
		};
		const expectedServices = ['account', 'listener', 'market', 'mosaic', 'namespace', 'network', 'transaction'];

		// Act:
		const api = new Api({ makeRequest, config });

		// Assert:
		expectedServices.forEach(service => {
			expect(api).toHaveProperty(service);
			expect(typeof api[service]).toBe('object');
		});
	});
});
