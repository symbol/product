import symbolClient from '../../src/services/symbolClient.js';
import fetchUtils from '../../src/utils/fetchUtils.js';
import {
	describe, expect, it, jest
} from '@jest/globals';

describe('symbolClient', () => {
	jest.spyOn(fetchUtils, 'fetchData').mockImplementation();
	const nodeUrl = 'http://localhost:3000';
	let client;

	beforeEach(() => {
		jest.clearAllMocks();
		client = symbolClient.create(nodeUrl);
	});

	describe('fetchNetworkCurrencyMosaicId', () => {
		it('can fetch network currency mosaic id successfully', async () => {
			// Arrange:
			const chain = {
				currencyMosaicId: '0x72C0\'212E\'67A0\'8BCE'
			};

			fetchUtils.fetchData.mockResolvedValue({ chain });

			// Act:
			const result = await client.fetchNetworkCurrencyMosaicId();

			// Assert:
			expect(result).toBe('72C0212E67A08BCE');
			expect(fetchUtils.fetchData).toHaveBeenCalledWith(`${nodeUrl}/network/properties`);
		});

		it('should throw an error when fetch fails', async () => {
			// Arrange:
			fetchUtils.fetchData.mockRejectedValue(new Error('Failed to fetch'));

			// Assert:
			const errorMessage = 'Failed to fetch network properties info: Failed to fetch';
			await expect(client.fetchNetworkCurrencyMosaicId()).rejects.toThrow(errorMessage);
		});
	});

	describe('fetchMosaicsInfo', () => {
		it('can fetch mosaics info successfully', async () => {
			// Arrange:
			const mosaicIds = ['393AFB0B19902759', '0005EC25E3F9072D'];

			const mockResponse = [
				{
					mosaic: {
						id: '393AFB0B19902759',
						divisibility: 6
					}
				},
				{
					mosaic: {
						id: '0005EC25E3F9072D',
						divisibility: 2
					}
				}
			];

			fetchUtils.fetchData.mockResolvedValue(mockResponse);

			// Act:
			const result = await client.fetchMosaicsInfo(mosaicIds);

			// Assert:
			expect(result).toStrictEqual({
				'0005EC25E3F9072D': {
					divisibility: 2
				},
				'393AFB0B19902759': {
					divisibility: 6
				}
			});
			expect(fetchUtils.fetchData).toHaveBeenCalledWith(`${nodeUrl}/mosaics`, 'POST', { mosaicIds });
		});

		it('should return empty object when mosaicIds is empty', async () => {
			// Act:
			const result = await client.fetchMosaicsInfo([]);

			// Assert:
			expect(result).toStrictEqual({});
			expect(fetchUtils.fetchData).not.toHaveBeenCalled();
		});

		it('should throw an error when fetch fails', async () => {
			// Arrange:
			const mosaicIds = ['393AFB0B19902759', '0005EC25E3F9072D'];

			fetchUtils.fetchData.mockRejectedValue(new Error('Failed to fetch'));

			// Assert:
			const errorMessage = 'Failed to fetch mosaics info: Failed to fetch';
			await expect(client.fetchMosaicsInfo(mosaicIds)).rejects.toThrow(errorMessage);
		});
	});

	describe('fetchAccountsMosaics', () => {
		it('can fetch accounts mosaics successfully', async () => {
			// Arrange:
			const addresses = ['TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY', 'TAUYVCHWXD7KPNLJIPRLKBBFKCNIHLJMQCE6BFQ'];

			const mockResponse = [
				{
					account: {
						address: '98223AF34A98119217DC2427C6DE7F577A33D8242A2F54C3',
						mosaics: [
							{
								id: '72C0212E67A08BCE',
								amount: '100'
							},
							{
								id: '62AAA97AD859F66A',
								amount: '20'
							}
						]
					}
				},
				{
					account: {
						address: '98298A88F6B8FEA7B56943E2B50425509A83AD2C8089E096',
						mosaics: [
							{
								id: '72C0212E67A08BCE',
								amount: '30'
							}
						]
					}
				}
			];

			fetchUtils.fetchData.mockResolvedValue(mockResponse);

			// Act:
			const result = await client.fetchAccountsMosaics(addresses);

			// Assert:
			expect(result).toStrictEqual({
				TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY: [
					{
						id: '72C0212E67A08BCE',
						amount: '100'
					},
					{
						id: '62AAA97AD859F66A',
						amount: '20'
					}
				],
				TAUYVCHWXD7KPNLJIPRLKBBFKCNIHLJMQCE6BFQ: [
					{
						id: '72C0212E67A08BCE',
						amount: '30'
					}
				]
			});
			expect(fetchUtils.fetchData).toHaveBeenCalledWith(`${nodeUrl}/accounts`, 'POST', { addresses });
		});

		it('should return empty object when addresses is empty', async () => {
			// Act:
			const result = await client.fetchAccountsMosaics([]);

			// Assert:
			expect(result).toStrictEqual({});
			expect(fetchUtils.fetchData).not.toHaveBeenCalled();
		});

		it('should throw an error when fetch fails', async () => {
			// Arrange:
			const addresses = ['TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY'];

			fetchUtils.fetchData.mockRejectedValue(new Error('Failed to fetch'));

			// Assert:
			const errorMessage = 'Failed to fetch account mosaics: Failed to fetch';
			await expect(client.fetchAccountsMosaics(addresses)).rejects.toThrow(errorMessage);
		});
	});

	describe('fetchMosaicNamespace', () => {
		it('can fetch mosaics namespace successfully', async () => {
			// Arrange:
			const mosaicIds = ['393AFB0B19902759', '0005EC25E3F9072D', '12CE9F2D2BCEE57D'];

			const mockResponse = {
				mosaicNames: [
					{
						mosaicId: '393AFB0B19902759',
						names: []
					},
					{
						mosaicId: '0005EC25E3F9072D',
						names: [
							'root.subnamespace'
						]
					},
					{
						mosaicId: '12CE9F2D2BCEE57D',
						names: ['root.subNamespace_1', 'root.subnamespace_2']
					}
				]
			};

			fetchUtils.fetchData.mockResolvedValue(mockResponse);

			// Act:
			const result = await client.fetchMosaicNamespace(mosaicIds);

			// Assert:
			expect(result).toStrictEqual({
				'393AFB0B19902759': [],
				'0005EC25E3F9072D': ['root.subnamespace'],
				'12CE9F2D2BCEE57D': ['root.subNamespace_1', 'root.subnamespace_2']
			});
			expect(fetchUtils.fetchData).toHaveBeenCalledWith(`${nodeUrl}/namespaces/mosaic/names`, 'POST', { mosaicIds });
		});

		it('returns empty object when mosaicIds is empty', async () => {
			// Act:
			const result = await client.fetchMosaicNamespace([]);

			// Assert:
			expect(result).toStrictEqual({});
			expect(fetchUtils.fetchData).not.toHaveBeenCalled();
		});

		it('throws an error when fetch fails', async () => {
			// Arrange:
			const mosaicIds = ['393AFB0B19902759', '0005EC25E3F9072D'];

			fetchUtils.fetchData.mockRejectedValue(new Error('Failed to fetch'));

			// Assert:
			const errorMessage = 'Failed to fetch mosaics namespace: Failed to fetch';
			await expect(client.fetchMosaicNamespace(mosaicIds)).rejects.toThrow(errorMessage);
		});
	});

	describe('fetchTransactionPageByAddress', () => {
		// Arrange:
		const mockAddress = 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY';
		const mockResponse = {
			data: [
				{
					meta: {},
					transaction: {},
					id: '1'
				},
				{
					meta: {},
					transaction: {},
					id: '2'
				}
			]
		};

		const assertThrowError = async (address, errorMessage) => {
			// Assert:
			await expect(client.fetchTransactionPageByAddress(address)).rejects.toThrow(errorMessage);
		};

		const assertSuccessFetch = async (offsetId, group, expectedCalledUrl) => {
			// Arrange:
			fetchUtils.fetchData.mockResolvedValue(mockResponse);

			// Act:
			const result = await client.fetchTransactionPageByAddress(mockAddress, offsetId, group);

			// Assert:
			expect(result).toStrictEqual(mockResponse.data);
			expect(fetchUtils.fetchData).toHaveBeenCalledWith(expectedCalledUrl);
		};

		it('can fetch confirmed transaction page by address', async () => {
			await assertSuccessFetch(
				'', 'confirmed',
				`${nodeUrl}/transactions/confirmed?order=desc&address=${mockAddress}&offset=&pageSize=10`
			);
		});

		it('can fetch unconfirmed transaction page by address with offset id', async () => {
			await assertSuccessFetch(
				'1', 'unconfirmed',
				`${nodeUrl}/transactions/unconfirmed?order=desc&address=${mockAddress}&offset=1&pageSize=10`
			);
		});

		it('throws an error when address is not provided', async () => {
			await assertThrowError(undefined, 'Address is required');
		});

		it('throws an error when fetch fails', async () => {
			// Arrange:
			fetchUtils.fetchData.mockRejectedValue(new Error('Failed to fetch'));

			// Assert:
			const errorMessage = 'Failed to fetch transactions page by address: Failed to fetch';
			await expect(client.fetchTransactionPageByAddress(mockAddress)).rejects.toThrow(errorMessage);
		});
	});

	describe('fetchInnerTransactionByAggregateIds', () => {
		// Arrange:
		const mockTransactionIds = ['1', '2'];
		const mockResponse = [
			{
				meta: {},
				transaction: {
					transactions: [
						{
							meta: {},
							transaction: {},
							id: '3'
						},
						{
							meta: {},
							transaction: {},
							id: '4'
						}
					]
				},
				id: '1'
			},
			{
				meta: {},
				transaction: {
					transactions: []
				},
				id: '2'
			}
		];

		const assertSuccessFetch = async (group, expectedCalledUrl) => {
			// Arrange:
			fetchUtils.fetchData.mockResolvedValue(mockResponse);

			// Act:
			const result = await client.fetchInnerTransactionByAggregateIds(mockTransactionIds, group);

			// Assert:
			expect(result).toStrictEqual({
				1: mockResponse[0].transaction.transactions,
				2: mockResponse[1].transaction.transactions
			});
			expect(fetchUtils.fetchData).toHaveBeenCalledWith(expectedCalledUrl, 'POST', { transactionIds: mockTransactionIds });
		};

		it('can fetch confirmed inner transactions by aggregate ids', async () => {
			await assertSuccessFetch('confirmed', `${nodeUrl}/transactions/confirmed`);
		});

		it('can fetch unconfirmed inner transactions by aggregate ids', async () => {
			await assertSuccessFetch('unconfirmed', `${nodeUrl}/transactions/unconfirmed`);
		});

		it('returns empty object when transactionIds is empty', async () => {
			// Act:
			const result = await client.fetchInnerTransactionByAggregateIds([]);

			// Assert:
			expect(result).toStrictEqual({});
			expect(fetchUtils.fetchData).not.toHaveBeenCalled();
		});

		it('throws an error when fetch fails', async () => {
			// Arrange:
			fetchUtils.fetchData.mockRejectedValue(new Error('Failed to fetch'));

			// Assert:
			const errorMessage = 'Failed to fetch inner transactions by aggregate ids: Failed to fetch';
			await expect(client.fetchInnerTransactionByAggregateIds(mockTransactionIds)).rejects.toThrow(errorMessage);
		});
	});
});
