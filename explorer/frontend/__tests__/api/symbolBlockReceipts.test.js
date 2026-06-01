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
						height: '3391665',
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
					height: 3391665,
					type: 'harvestFee',
					group: 'balanceChange',
					targetAddress: 'TARGET_ADDRESS',
					sender: null,
					to: null,
					artifactId: null,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 103, isNative: true }]
				},
				{
					version: 1,
					height: 3391665,
					type: 'mosaicRentalFee',
					group: 'balanceTransfer',
					targetAddress: null,
					sender: 'SENDER_ADDRESS',
					to: 'RECIPIENT_ADDRESS',
					artifactId: null,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 50, isNative: true }]
				},
				{
					version: 1,
					height: 3391665,
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
					height: 3391665,
					type: 'inflation',
					group: 'inflation',
					targetAddress: null,
					sender: null,
					to: null,
					artifactId: null,
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
						height: '3391665',
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
						height: '3391666',
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
					height: 3391666,
					type: 'inflation',
					group: 'inflation',
					targetAddress: null,
					sender: null,
					to: null,
					artifactId: null,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 108.609356, isNative: true }]
				}
			],
			pageNumber: 2
		});
	});

	it('fetches account balance transfer receipts by sender address and group', async () => {
		// Arrange:
		const response = {
			data: [
				{
					statement: {
						height: '3391665',
						receipts: [
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
								type: 8515,
								targetAddress: 'TARGET_ADDRESS',
								mosaicId: '72C0212E67A08BCE',
								amount: '103000000'
							}
						]
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchBlockReceiptPage({
			senderAddress: 'SENDER_ADDRESS',
			group: 'balanceTransfer'
		});

		// Assert:
		const expectedUrl = '/api/symbol-node/statements/transaction?pageNumber=1&pageSize=100&order=desc'
			+ '&senderAddress=SENDER_ADDRESS';
		expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
		expect(result).toEqual({
			data: [
				{
					version: 1,
					height: 3391665,
					type: 'mosaicRentalFee',
					group: 'balanceTransfer',
					targetAddress: null,
					sender: 'SENDER_ADDRESS',
					to: 'RECIPIENT_ADDRESS',
					artifactId: null,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 50, isNative: true }]
				}
			],
			pageNumber: 1
		});
	});

	it('fetches harvested blocks by target address and harvest fee receipt type', async () => {
		// Arrange:
		const response = {
			data: [
				{
					statement: {
						height: '3391665',
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
								type: 12616,
								targetAddress: 'TARGET_ADDRESS',
								mosaicId: '72C0212E67A08BCE',
								amount: '50000000'
							},
							{
								version: 1,
								type: 8515,
								targetAddress: 'OTHER_ADDRESS',
								mosaicId: '72C0212E67A08BCE',
								amount: '200000000'
							}
						]
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchBlockReceiptPage({
			targetAddress: 'TARGET_ADDRESS',
			receiptType: 8515,
			group: 'balanceChange'
		});

		// Assert:
		const expectedUrl = '/api/symbol-node/statements/transaction?pageNumber=1&pageSize=100&order=desc'
			+ '&targetAddress=TARGET_ADDRESS&receiptType=8515';
		expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
		expect(result).toEqual({
			data: [
				{
					version: 1,
					height: 3391665,
					type: 'harvestFee',
					group: 'balanceChange',
					targetAddress: 'TARGET_ADDRESS',
					sender: null,
					to: null,
					artifactId: null,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 103, isNative: true }]
				}
			],
			pageNumber: 1
		});
	});

	it('excludes requested receipt types from account receipt results', async () => {
		// Arrange:
		const response = {
			data: [
				{
					statement: {
						height: '3391665',
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
								type: 12616,
								targetAddress: 'TARGET_ADDRESS',
								mosaicId: '72C0212E67A08BCE',
								amount: '50000000'
							}
						]
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchBlockReceiptPage({
			targetAddress: 'TARGET_ADDRESS',
			group: 'balanceChange',
			excludedReceiptTypes: [8515]
		});

		// Assert:
		expect(result).toEqual({
			data: [
				{
					version: 1,
					height: 3391665,
					type: 'lockHashCreated',
					group: 'balanceChange',
					targetAddress: 'TARGET_ADDRESS',
					sender: null,
					to: null,
					artifactId: null,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 50, isNative: true }]
				}
			],
			pageNumber: 1
		});
	});

	it('includes only requested receipt types in account receipt results', async () => {
		// Arrange:
		const emptyResponse = {
			data: []
		};
		const lockHashExpiredResponse = {
			data: [
				{
					statement: {
						height: '3391668',
						receipts: [
							{
								version: 1,
								type: 9032,
								targetAddress: 'TARGET_ADDRESS',
								mosaicId: '72C0212E67A08BCE',
								amount: '70000000'
							}
						]
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce({
			data: [
				...emptyResponse.data,
				...lockHashExpiredResponse.data
			]
		});

		// Act:
		const result = await fetchBlockReceiptPage({
			targetAddress: 'TARGET_ADDRESS',
			group: 'balanceChange',
			includedReceiptTypes: [12616, 9032]
		});

		// Assert:
		const expectedUrl = '/api/symbol-node/statements/transaction?pageNumber=1&pageSize=100&order=desc'
			+ '&targetAddress=TARGET_ADDRESS&receiptType=12616&receiptType=9032';
		expect(makeRequest).toHaveBeenCalledWith(expectedUrl);
		expect(result).toEqual({
			data: [
				{
					version: 1,
					height: 3391668,
					type: 'lockHashExpired',
					group: 'balanceChange',
					targetAddress: 'TARGET_ADDRESS',
					sender: null,
					to: null,
					artifactId: null,
					mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 70, isNative: true }]
				}
			],
			pageNumber: 1
		});
	});

	it('does not scan following pages when filtered account receipts are empty', async () => {
		// Arrange:
		const response = {
			data: [
				{
					statement: {
						height: '3391665',
						receipts: [
							{
								version: 1,
								type: 8515,
								targetAddress: 'TARGET_ADDRESS',
								mosaicId: '72C0212E67A08BCE',
								amount: '103000000'
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
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchBlockReceiptPage({
			targetAddress: 'TARGET_ADDRESS',
			group: 'balanceChange',
			excludedReceiptTypes: [8515]
		});

		// Assert:
		expect(makeRequest).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			data: [],
			pageNumber: 1
		});
	});
});
