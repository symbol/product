import config from '@/config';
import * as utils from '@/utils/server';
import { fetchHashLockPage } from '@/variants/symbol/api/hashLocks';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/hashLocks', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
		config.NATIVE_MOSAIC_ID = '72C0212E67A08BCE';
		config.NATIVE_MOSAIC_DIVISIBILITY = 6;
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
		jest.restoreAllMocks();
	});

	it('fetches and formats hash locks by account address', async () => {
		// Arrange:
		const response = {
			data: [
				{
					lock: {
						hash: 'HASH_LOCK_TRANSACTION_1',
						endHeight: '12345',
						status: 0,
						mosaicId: '72C0212E67A08BCE',
						amount: '50000000'
					}
				},
				{
					lock: {
						hash: 'HASH_LOCK_TRANSACTION_2',
						endHeight: '23456',
						status: 1,
						mosaicId: '6F7904E6DF09D21D',
						amount: '1000'
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchHashLockPage({
			address: 'TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ',
			pageNumber: 2
		});

		// Assert:
		const expectedUrl = '/api/symbol-node/lock/hash?pageNumber=2&pageSize=10&order=desc'
			+ '&address=TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ';
		expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
		expect(result).toEqual({
			data: [
				{
					transactionHash: 'HASH_LOCK_TRANSACTION_1',
					endHeight: 12345,
					status: 'unused',
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 50, isNative: true }]
				},
				{
					transactionHash: 'HASH_LOCK_TRANSACTION_2',
					endHeight: 23456,
					status: 'used',
					mosaics: [{ id: '6F7904E6DF09D21D', name: '6F7904E6DF09D21D', amount: '1000', isNative: false }]
				}
			],
			pageNumber: 2
		});
	});
});
