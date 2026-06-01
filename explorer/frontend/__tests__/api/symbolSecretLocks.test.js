import config from '@/config';
import * as utils from '@/utils/server';
import { fetchSecretLockPage } from '@/variants/symbol/api/secretLocks';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/secretLocks', () => {
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

	it('fetches and formats secret locks by account address', async () => {
		// Arrange:
		const response = {
			data: [
				{
					lock: {
						recipientAddress: '980FE0526FA6F38999A3B4CF35A928A4391D4620634A025A',
						secret: 'SECRET_HASH_1',
						endHeight: '12345',
						status: 0,
						hashAlgorithm: 0,
						mosaicId: '72C0212E67A08BCE',
						amount: '50000000'
					}
				},
				{
					lock: {
						recipientAddress: 'RECIPIENT_ADDRESS',
						secret: 'SECRET_HASH_2',
						endHeight: '23456',
						status: 1,
						hashAlgorithm: 2,
						mosaicId: '6F7904E6DF09D21D',
						amount: '1000'
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchSecretLockPage({
			address: 'TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ',
			pageNumber: 2
		});

		// Assert:
		const expectedUrl = '/api/symbol-node/lock/secret?pageNumber=2&pageSize=10&order=desc'
			+ '&address=TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ';
		expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
		expect(result).toEqual({
			data: [
				{
					recipient: 'TAH6AUTPU3ZYTGNDWTHTLKJIUQ4R2RRAMNFAEWQ',
					secret: 'SECRET_HASH_1',
					endHeight: 12345,
					status: 'unused',
					hashAlgorithm: 'sha3256',
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 50, isNative: true }]
				},
				{
					recipient: 'RECIPIENT_ADDRESS',
					secret: 'SECRET_HASH_2',
					endHeight: 23456,
					status: 'used',
					hashAlgorithm: 'hash256',
					mosaics: [{ id: '6F7904E6DF09D21D', name: '6F7904E6DF09D21D', amount: '1000', isNative: false }]
				}
			],
			pageNumber: 2
		});
	});
});
