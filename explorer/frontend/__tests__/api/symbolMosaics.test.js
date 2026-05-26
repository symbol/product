import config from '@/config';
import * as utils from '@/utils/server';
import { fetchMosaicInfo, fetchMosaicPage } from '@/variants/symbol/api/mosaics';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/mosaics', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
		jest.restoreAllMocks();
	});

	describe('fetchMosaicPage', () => {
		it('fetches mosaic aliases and formats Symbol mosaic properties', async () => {
			// Arrange:
			const response = {
				data: [
					{
						mosaic: {
							id: '72C0212E67A08BCE',
							ownerAddress: 'OWNER_ADDRESS',
							supply: '123456',
							divisibility: 3,
							startHeight: '100',
							duration: '0',
							flags: 15
						}
					},
					{
						mosaic: {
							id: '78C3CDF0896248DB',
							ownerAddress: 'OWNER_ADDRESS_2',
							supply: '1000',
							divisibility: 2,
							startHeight: '200',
							duration: '50',
							flags: 0
						}
					}
				]
			};
			const mosaicNamesResponse = {
				mosaicNames: [
					{
						mosaicId: '72C0212E67A08BCE',
						names: ['symbol.xym', 'currency']
					},
					{
						mosaicId: '78C3CDF0896248DB',
						names: []
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce(mosaicNamesResponse);

			// Act:
			const result = await fetchMosaicPage({
				pageNumber: 2,
				pageSize: 50
			});

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, '/api/symbol-node/mosaics?pageNumber=2&pageSize=50&order=desc');
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/namespaces/mosaic/names', {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds: ['72C0212E67A08BCE', '78C3CDF0896248DB']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result).toEqual({
				data: [
					expect.objectContaining({
						id: '72C0212E67A08BCE',
						aliasNames: ['symbol.xym', 'currency'],
						value: '123.456',
						expirationHeight: 0,
						isSupplyMutable: true,
						isTransferable: true,
						isRestrictable: true,
						isRevokable: true
					}),
					expect.objectContaining({
						id: '78C3CDF0896248DB',
						aliasNames: [],
						value: '10.00',
						expirationHeight: 250,
						isSupplyMutable: false,
						isTransferable: false,
						isRestrictable: false,
						isRevokable: false
					})
				],
				pageNumber: 2
			});
		});

		it('falls back to empty aliases when mosaic alias lookup is unavailable', async () => {
			// Arrange:
			const response = {
				data: [
					{
						mosaic: {
							id: '72C0212E67A08BCE',
							ownerAddress: 'OWNER_ADDRESS',
							supply: '123456',
							divisibility: 3,
							startHeight: '100',
							duration: '0',
							flags: 15
						}
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockRejectedValueOnce({
				response: {
					status: 404
				}
			});

			// Act:
			const result = await fetchMosaicPage();

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(2);
			expect(result.data[0]).toEqual(expect.objectContaining({
				id: '72C0212E67A08BCE',
				aliasNames: []
			}));
		});
	});

	describe('fetchMosaicInfo', () => {
		it('fetches mosaic info and aliases', async () => {
			// Arrange:
			const response = {
				mosaic: {
					id: '6F7904E6DF09D21D',
					ownerAddress: '980FE0526FA6F38999A3B4CF35A928A4391D4620634A025A',
					supply: '10000',
					divisibility: 2,
					startHeight: '3407528',
					duration: '0',
					flags: 14
				}
			};
			const mosaicNamesResponse = {
				mosaicNames: [
					{
						mosaicId: '6F7904E6DF09D21D',
						names: ['symbol.alias']
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce(mosaicNamesResponse);

			// Act:
			const result = await fetchMosaicInfo('6F7904E6DF09D21D');

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, '/api/symbol-node/mosaics/6F7904E6DF09D21D');
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/namespaces/mosaic/names', {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds: ['6F7904E6DF09D21D']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result).toEqual(expect.objectContaining({
				id: '6F7904E6DF09D21D',
				name: '6F7904E6DF09D21D',
				aliasNames: ['symbol.alias'],
				value: '100.00',
				isSupplyMutable: false,
				isTransferable: true,
				isRestrictable: true,
				isRevokable: true
			}));
		});
	});
});
