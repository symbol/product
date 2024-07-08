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
});