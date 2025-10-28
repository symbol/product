import { Api } from '../../src/api';
import { expect, jest } from '@jest/globals';

describe('api/index.js Api aggregator', () => {
	it('constructs service instances and exposes them on api object', () => {
		// Arrange:
		const makeRequest = jest.fn(async () => ({}));
		const config = {
			marketDataURL: 'https://example.market',
			marketCurrencies: ['USD'],
			statisticsServiceURL: { testnet: 'https://stats.example' }
		};
		const namespaces = [
			'account',
			'block',
			'listener',
			'network',
			'token',
			'transaction'
		];

		// Act:
		const api = new Api({ makeRequest, config });

		// Assert:
		expect(api).toBeDefined();
		// Services expected on the aggregator

		namespaces.forEach(namespace => {
			expect(api).toHaveProperty(namespace);
			expect(typeof api[namespace]).toBe('object');
		});
	});
});
