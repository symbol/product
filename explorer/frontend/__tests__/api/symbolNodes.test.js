import config from '@/config';
import * as utils from '@/utils/server';
import { fetchNodeList } from '@/variants/symbol/api/nodes';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/nodes', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.NODELIST_URL = 'https://node.list';
		config.SYMBOL_NETWORK_IDENTIFIER = 152;
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
		jest.restoreAllMocks();
	});

	it('maps Nodewatch node fields required by the node list', async () => {
		// Arrange:
		const response = [
			{
				balance: 123.456789,
				endpoint: 'https://symbol.example:3001',
				finalizedHeight: 1230,
				geoLocation: {
					city: 'Dusseldorf',
					country: 'Germany',
					lat: 50.0,
					lon: 6.0
				},
				height: 1234,
				mainPublicKey: 'A'.repeat(64),
				name: 'symbol-node',
				nodePublicKey: 'B'.repeat(64),
				roles: 3,
				version: '1.0.3.8'
			}
		];
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValue(response);

		// Act:
		const result = await fetchNodeList();

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith('https://node.list');
		expect(result).toEqual([
			{
				address: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				balance: 123.456789,
				endpoint: 'https://symbol.example:3001',
				finalizedHeight: 1230,
				geoLocation: {
					city: 'Dusseldorf',
					country: 'Germany',
					lat: 50.0,
					lon: 6.0
				},
				height: 1234,
				mainPublicKey: 'A'.repeat(64),
				name: 'symbol-node',
				nodePublicKey: 'B'.repeat(64),
				roles: 3,
				version: '1.0.3.8'
			}
		]);
	});

	it('maps Symbol peer fields when Nodewatch URL is not configured', async () => {
		// Arrange:
		config.NODELIST_URL = undefined;
		const response = [
			{
				apiNodeInfo: {
					isSSL: true,
					restVersion: '2.4.4'
				},
				extraData: {
					balance: 987.654321,
					finalizedHeight: 4560,
					height: 4567
				},
				friendlyName: 'peer-node',
				host: 'peer.example',
				nodePublicKey: 'C'.repeat(64),
				port: 7900,
				publicKey: 'D'.repeat(64),
				roles: 3,
				version: 16777992
			}
		];
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValue(response);

		// Act:
		const result = await fetchNodeList();

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/node/peers');
		expect(result).toEqual([
			{
				address: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				balance: 987.654321,
				endpoint: 'https://peer.example:3001',
				finalizedHeight: 4560,
				geoLocation: undefined,
				height: 4567,
				mainPublicKey: 'D'.repeat(64),
				name: 'peer-node',
				nodePublicKey: 'C'.repeat(64),
				roles: 3,
				version: '1.0.3.8'
			}
		]);
	});

	it('normalizes Symbol Nodewatch base node URL to the peer-node endpoint', async () => {
		// Arrange:
		config.NODELIST_URL = 'https://nodewatch.example/api/symbol/nodes';
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValue([]);

		// Act:
		const result = await fetchNodeList();

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith('https://nodewatch.example/api/symbol/nodes/peer');
		expect(result).toEqual([]);
	});
});
