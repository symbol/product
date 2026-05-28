import config from '@/config';
import * as utils from '@/utils/server';
import { fetchBlockReceiptPage } from '@/variants/symbol/api/blockReceipts';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/blockReceipts', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
		config.NATIVE_MOSAIC_ID = '72C0212E67A08BCE';
		config.NATIVE_MOSAIC_DIVISIBILITY = 6;
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
	});

	it('fetches block receipts by height and groups supported receipt types', async () => {
		// Arrange:
		const response = {
			data: [
				{
					statement: {
						receipts: [
							{
								version: 1,
								type: 8515,
								targetAddress: 'TARGET_ADDRESS',
								mosaicId: '72C0212E67A08BCE',
								amount: '103000000'
							},
							{
								version: 1,
								type: 4685,
								senderAddress: 'SENDER_ADDRESS',
								recipientAddress: 'RECIPIENT_ADDRESS',
								mosaicId: '72C0212E67A08BCE',
								amount: '50000000'
							},
							{
								version: 1,
								type: 16717,
								artifactId: '54521A62D14B4558'
							},
							{
								version: 1,
								type: 20803,
								mosaicId: '72C0212E67A08BCE',
								amount: '108609356'
							},
							{
								version: 1,
								type: 9999
							}
						]
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);
		const expectedUrl = '/api/symbol-node/statements/transaction?pageNumber=2&pageSize=100&order=desc&height=3391665';

		// Act:
		const result = await fetchBlockReceiptPage({ height: 3391665, pageNumber: 2 });

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
		expect(result).toEqual({
			data: [
				{
					version: 1,
					type: 'harvestFee',
					group: 'balanceChange',
					targetAddress: 'TARGET_ADDRESS',
					sender: null,
					to: null,
					artifactId: undefined,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 103, isNative: true }]
				},
				{
					version: 1,
					type: 'mosaicRentalFee',
					group: 'balanceTransfer',
					targetAddress: null,
					sender: 'SENDER_ADDRESS',
					to: 'RECIPIENT_ADDRESS',
					artifactId: undefined,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 50, isNative: true }]
				},
				{
					version: 1,
					type: 'mosaicExpired',
					group: 'artifactExpiry',
					targetAddress: null,
					sender: null,
					to: null,
					artifactId: '54521A62D14B4558',
					mosaics: []
				},
				{
					version: 1,
					type: 'inflation',
					group: 'inflation',
					targetAddress: null,
					sender: null,
					to: null,
					artifactId: undefined,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 108.609356, isNative: true }]
				}
			],
			pageNumber: 2
		});
	});

	it('continues fetching when a statement page contains only unsupported receipt types', async () => {
		// Arrange:
		const firstResponse = {
			data: [
				{
					statement: {
						receipts: [
							{
								version: 1,
								type: 9999
							}
						]
					}
				}
			],
			pagination: {
				pageNumber: 1,
				pageSize: 100,
				totalPages: 2
			}
		};
		const secondResponse = {
			data: [
				{
					statement: {
						receipts: [
							{
								version: 1,
								type: 20803,
								mosaicId: '72C0212E67A08BCE',
								amount: '108609356'
							}
						]
					}
				}
			],
			pagination: {
				pageNumber: 2,
				pageSize: 100,
				totalPages: 2
			}
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(firstResponse);
		makeRequest.mockResolvedValueOnce(secondResponse);

		// Act:
		const result = await fetchBlockReceiptPage({ height: 3391665, pageNumber: 1 });

		// Assert:
		expect(makeRequest).toHaveBeenNthCalledWith(
			1,
			'/api/symbol-node/statements/transaction?pageNumber=1&pageSize=100&order=desc&height=3391665'
		);
		expect(makeRequest).toHaveBeenNthCalledWith(
			2,
			'/api/symbol-node/statements/transaction?pageNumber=2&pageSize=100&order=desc&height=3391665'
		);
		expect(result).toEqual({
			data: [
				{
					version: 1,
					type: 'inflation',
					group: 'inflation',
					targetAddress: null,
					sender: null,
					to: null,
					artifactId: undefined,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 108.609356, isNative: true }]
				}
			],
			pageNumber: 2
		});
	});
});
