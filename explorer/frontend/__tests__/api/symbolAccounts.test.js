import config from '@/config';
import * as utils from '@/utils/server';
import { fetchAccountInfo, fetchAccountInfoByPublicKey, fetchAccountPage } from '@/variants/symbol/api/accounts';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/accounts', () => {
	const originalConfig = { ...config };
	const networkPropertiesResponse = {
		chain: {
			totalChainImportance: '7\'842\'928\'625\'000\'000'
		}
	};

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
		config.NATIVE_MOSAIC_ID = '72C0212E67A08BCE';
		config.NATIVE_MOSAIC_TICKER = 'XYM';
		config.NATIVE_MOSAIC_DIVISIBILITY = 6;
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
		jest.restoreAllMocks();
	});

	describe('fetchAccountPage', () => {
		it('fetches namespaces linked to account addresses', async () => {
			// Arrange:
			const response = {
				data: [
					{
						account: {
							address: 'TALICE2GMA34VQ75JZDLEA5DR55VBILN4F6A3BY',
							publicKey: 'A'.repeat(64),
							importance: '90000000000000',
							addressHeight: '123',
							mosaics: [
								{
									id: '72C0212E67A08BCE',
									amount: '1234567'
								}
							]
						}
					},
					{
						account: {
							address: 'TBOB7R7C7GJSSQMRZG6RYWZPYMZLJYFVBWQ4MVA',
							publicKey: '0'.repeat(64),
							importance: '0',
							addressHeight: '124',
							mosaics: []
						}
					}
				]
			};
			const accountNamesResponse = {
				accountNames: [
					{
						address: 'TALICE2GMA34VQ75JZDLEA5DR55VBILN4F6A3BY',
						names: ['alice', 'company.alice']
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			makeRequest.mockResolvedValueOnce(accountNamesResponse);

			// Act:
			const result = await fetchAccountPage({
				pageNumber: 2,
				pageSize: 50
			});

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(
				1,
				'/api/symbol-node/accounts?pageNumber=2&pageSize=50&order=desc'
			);
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/network/properties');
			expect(makeRequest).toHaveBeenNthCalledWith(3, '/api/symbol-node/namespaces/account/names', {
				method: 'POST',
				body: JSON.stringify({
					addresses: [
						'TALICE2GMA34VQ75JZDLEA5DR55VBILN4F6A3BY',
						'TBOB7R7C7GJSSQMRZG6RYWZPYMZLJYFVBWQ4MVA'
					]
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result).toEqual({
				data: [
					{
						address: 'TALICE2GMA34VQ75JZDLEA5DR55VBILN4F6A3BY',
						publicKey: 'A'.repeat(64),
						description: null,
						namespaces: ['alice', 'company.alice'],
						balance: 1.234567,
						vestedBalance: 0,
						importance: 1.1475305246705596,
						mosaics: [
							{
								id: '72C0212E67A08BCE',
								name: 'XYM',
								amount: 1.234567,
								isCreatedByAccount: false
							}
						],
						isHarvestingActive: false,
						isMultisig: false,
						cosignatories: [],
						cosignatoryOf: [],
						harvestedBlocks: null,
						harvestedFees: null,
						height: 123,
						minCosignatories: 0,
						remoteAddress: null
					},
					{
						address: 'TBOB7R7C7GJSSQMRZG6RYWZPYMZLJYFVBWQ4MVA',
						publicKey: null,
						description: null,
						namespaces: [],
						balance: 0,
						vestedBalance: 0,
						importance: 0,
						mosaics: [],
						isHarvestingActive: false,
						isMultisig: false,
						cosignatories: [],
						cosignatoryOf: [],
						harvestedBlocks: null,
						harvestedFees: null,
						height: 124,
						minCosignatories: 0,
						remoteAddress: null
					}
				],
				pageNumber: 2
			});
		});

		it('keeps account page available when account namespace lookup fails with 409', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						account: {
							address: 'TALICE2GMA34VQ75JZDLEA5DR55VBILN4F6A3BY',
							mosaics: []
						}
					}
				]
			});
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			makeRequest.mockRejectedValueOnce({
				response: {
					status: 409
				}
			});

			// Act:
			const result = await fetchAccountPage();

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(3);
			expect(result.data[0].namespaces).toEqual([]);
		});

		it('matches namespace aliases returned with hex account addresses', async () => {
			// Arrange:
			const accountAddressHex = '983FF5A219FBACA421FD33D8B7C2BF6A75F961A0FD90B356';
			const accountAddress = 'TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ';
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						account: {
							address: accountAddressHex,
							importance: '0',
							mosaics: []
						}
					}
				]
			});
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			makeRequest.mockResolvedValueOnce({
				accountNames: [
					{
						address: accountAddressHex,
						names: ['pasomi.sn']
					}
				]
			});

			// Act:
			const result = await fetchAccountPage();

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(3, '/api/symbol-node/namespaces/account/names', {
				method: 'POST',
				body: JSON.stringify({
					addresses: [accountAddress]
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result.data[0].address).toBe(accountAddress);
			expect(result.data[0].namespaces).toEqual(['pasomi.sn']);
		});

		it('fetches latest accounts ordered by collection id', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({ data: [] });
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);

			// Act:
			await fetchAccountPage({
				isLatest: true
			});

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, '/api/symbol-node/accounts?pageNumber=1&pageSize=10&order=desc&orderBy=id');
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/network/properties');
		});

		it('fetches rich list accounts ordered by native mosaic balance', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({ data: [] });
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			const expectedUrl = '/api/symbol-node/accounts?pageNumber=1&pageSize=10&order=desc&orderBy=balance&mosaicId=72C0212E67A08BCE';

			// Act:
			await fetchAccountPage({
				isRichList: true
			});

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, expectedUrl);
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/network/properties');
		});

		it('fetches mosaic holder accounts ordered by target mosaic balance', async () => {
			// Arrange:
			const targetMosaicId = '6F7904E6DF09D21D';
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				data: [
					{
						account: {
							address: 'TALICE2GMA34VQ75JZDLEA5DR55VBILN4F6A3BY',
							publicKey: 'A'.repeat(64),
							importance: '0',
							mosaics: [
								{
									id: config.NATIVE_MOSAIC_ID,
									amount: '1234567'
								},
								{
									id: targetMosaicId,
									amount: '500000'
								}
							]
						}
					}
				]
			});
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			makeRequest.mockResolvedValueOnce({ accountNames: [] });

			// Act:
			const result = await fetchAccountPage({
				pageNumber: 2,
				mosaic: targetMosaicId,
				mosaicDivisibility: 2
			});

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(
				1,
				'/api/symbol-node/accounts?pageNumber=2&pageSize=10&order=desc&mosaicId=6F7904E6DF09D21D&orderBy=balance'
			);
			expect(result.data[0].balance).toBe(5000);
		});
	});

	describe('fetchAccountInfo', () => {
		const targetAddress = 'TAMYTGVH3UEVZRQSD64LGSMPKNTKMASOIDNYROI';
		const accountResponse = {
			account: {
				address: targetAddress,
				publicKey: 'A'.repeat(64),
				importance: '6507430185278376',
				addressHeight: '1',
				mosaics: [
					{
						id: '72C0212E67A08BCE',
						amount: '7270485345948776'
					}
				]
			}
		};

		it('calculates account importance using totalChainImportance from network properties', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(accountResponse);
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);

			// Act:
			const result = await fetchAccountInfo(targetAddress);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, `/api/symbol-node/accounts/${targetAddress}`);
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/network/properties');
			expect(result.importance).toBeCloseTo(82.97194194188367);
		});

		it('calculates public key account importance using totalChainImportance from network properties', async () => {
			// Arrange:
			const publicKey = 'B'.repeat(64);
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(accountResponse);
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);

			// Act:
			const result = await fetchAccountInfoByPublicKey(publicKey);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, `/api/symbol-node/accounts/${publicKey}`);
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/network/properties');
			expect(result.importance).toBeCloseTo(82.97194194188367);
		});
	});
});
