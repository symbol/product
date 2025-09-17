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

		// Act:
		const api = new Api({ makeRequest, config });

		// Assert:
		expect(api).toBeDefined();
		// Services expected on the aggregator
		expect(api).toHaveProperty('account');
		expect(api).toHaveProperty('transaction');
		expect(api).toHaveProperty('mosaic');
		expect(api).toHaveProperty('namespace');
		expect(api).toHaveProperty('network');
		expect(api).toHaveProperty('market');
		expect(api).toHaveProperty('harvesting');
		expect(api).toHaveProperty('listener');

		// Basic type checks
		expect(typeof api.account).toBe('object');
		expect(typeof api.transaction).toBe('object');
		expect(typeof api.mosaic).toBe('object');
		expect(typeof api.namespace).toBe('object');
		expect(typeof api.network).toBe('object');
		expect(typeof api.market).toBe('object');
		expect(typeof api.harvesting).toBe('object');
		expect(typeof api.listener).toBe('object');
	});
});
