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
	const chainInfoResponse = {
		latestFinalizedBlock: {
			finalizationEpoch: 10
		}
	};

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
		config.NATIVE_MOSAIC_ID = '72C0212E67A08BCE';
		config.NATIVE_MOSAIC_TICKER = 'XYM';
		config.NATIVE_MOSAIC_DIVISIBILITY = 6;
		config.SYMBOL_NETWORK_IDENTIFIER = 152;
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
						accountType: null,
						supplementalKeys: {
							linked: null,
							node: null,
							vrf: null
						},
						votingKeys: [],
						importanceHistory: [],
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
						accountType: null,
						supplementalKeys: {
							linked: null,
							node: null,
							vrf: null
						},
						votingKeys: [],
						importanceHistory: [],
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
				accountType: 1,
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
			makeRequest.mockResolvedValueOnce(chainInfoResponse);
			makeRequest.mockResolvedValueOnce({ accountNames: [] });
			makeRequest.mockResolvedValueOnce([
				{
					mosaic: {
						id: '72C0212E67A08BCE',
						ownerAddress: targetAddress,
						divisibility: 6
					}
				}
			]);
			makeRequest.mockResolvedValueOnce({ mosaicNames: [] });

			// Act:
			const result = await fetchAccountInfo(targetAddress);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, `/api/symbol-node/accounts/${targetAddress}`);
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/network/properties');
			expect(makeRequest).toHaveBeenNthCalledWith(3, '/api/symbol-node/chain/info');
			expect(makeRequest).toHaveBeenNthCalledWith(4, '/api/symbol-node/namespaces/account/names', {
				method: 'POST',
				body: JSON.stringify({
					addresses: [targetAddress]
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(makeRequest).toHaveBeenNthCalledWith(5, '/api/symbol-node/mosaics', {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds: ['72C0212E67A08BCE']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(makeRequest).toHaveBeenNthCalledWith(6, '/api/symbol-node/namespaces/mosaic/names', {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds: ['72C0212E67A08BCE']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result.importance).toBeCloseTo(82.97194194188367);
			expect(result.namespaces).toEqual([]);
			expect(result.accountType).toBe('main');
		});

		it('formats account state mosaics with mosaic divisibility and namespace aliases', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				account: {
					...accountResponse.account,
					mosaics: [
						{
							id: '72C0212E67A08BCE',
							amount: '1234567'
						},
						{
							id: '6F7904E6DF09D21D',
							amount: '98765'
						},
						{
							id: '0DC67FBE1CAD29E3',
							amount: '4000'
						}
					]
				}
			});
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			makeRequest.mockResolvedValueOnce(chainInfoResponse);
			makeRequest.mockResolvedValueOnce({
				accountNames: [
					{
						address: targetAddress,
						names: ['alice', 'company.alice']
					}
				]
			});
			makeRequest.mockResolvedValueOnce([
				{
					mosaic: {
						id: '72C0212E67A08BCE',
						ownerAddress: targetAddress,
						divisibility: 6
					}
				},
				{
					mosaic: {
						id: '6F7904E6DF09D21D',
						ownerAddress: 'TBOB7R7C7GJSSQMRZG6RYWZPYMZLJYFVBWQ4MVA',
						divisibility: 2
					}
				},
				{
					mosaic: {
						id: '0DC67FBE1CAD29E3',
						divisibility: 0
					}
				}
			]);
			makeRequest.mockResolvedValueOnce({
				mosaicNames: [
					{
						mosaicId: '72C0212E67A08BCE',
						names: ['symbol.xym']
					},
					{
						mosaicId: '6F7904E6DF09D21D',
						names: ['foo.bar']
					}
				]
			});

			// Act:
			const result = await fetchAccountInfo(targetAddress);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(3, '/api/symbol-node/chain/info');
			expect(makeRequest).toHaveBeenNthCalledWith(4, '/api/symbol-node/namespaces/account/names', {
				method: 'POST',
				body: JSON.stringify({
					addresses: [targetAddress]
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(makeRequest).toHaveBeenNthCalledWith(5, '/api/symbol-node/mosaics', {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds: ['72C0212E67A08BCE', '6F7904E6DF09D21D', '0DC67FBE1CAD29E3']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(makeRequest).toHaveBeenNthCalledWith(6, '/api/symbol-node/namespaces/mosaic/names', {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds: ['72C0212E67A08BCE', '6F7904E6DF09D21D', '0DC67FBE1CAD29E3']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result.mosaics).toEqual([
				{
					id: '72C0212E67A08BCE',
					name: 'symbol.xym',
					amount: 1.234567,
					isCreatedByAccount: true
				},
				{
					id: '6F7904E6DF09D21D',
					name: 'foo.bar',
					amount: 987.65,
					isCreatedByAccount: false
				},
				{
					id: '0DC67FBE1CAD29E3',
					name: '0DC67FBE1CAD29E3',
					amount: 4000,
					isCreatedByAccount: false
				}
			]);
			expect(result.namespaces).toEqual(['alice', 'company.alice']);
		});

		it('keeps account info available when batch mosaic property lookup fails with a client error', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(accountResponse);
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			makeRequest.mockResolvedValueOnce(chainInfoResponse);
			makeRequest.mockResolvedValueOnce({ accountNames: [] });
			makeRequest.mockRejectedValueOnce({
				response: {
					status: 409
				}
			});
			makeRequest.mockResolvedValueOnce({ mosaicNames: [] });

			// Act:
			const result = await fetchAccountInfo(targetAddress);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(5, '/api/symbol-node/mosaics', {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds: ['72C0212E67A08BCE']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result).not.toBeNull();
			expect(result.mosaics).toEqual([
				{
					id: '72C0212E67A08BCE',
					name: 'XYM',
					amount: 7270485345.948776,
					isCreatedByAccount: false
				}
			]);
		});

		it('maps supplemental public keys to addresses', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				account: {
					address: targetAddress,
					publicKey: 'A'.repeat(64),
					importance: '0',
					mosaics: [],
					supplementalPublicKeys: {
						linked: { publicKey: 'B'.repeat(64) },
						node: { publicKey: 'C'.repeat(64) },
						vrf: { publicKey: 'D'.repeat(64) }
					}
				}
			});
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			makeRequest.mockResolvedValueOnce(chainInfoResponse);
			makeRequest.mockResolvedValueOnce({ accountNames: [] });

			// Act:
			const result = await fetchAccountInfo(targetAddress);

			// Assert:
			expect(result.supplementalKeys).toEqual({
				linked: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				node: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				vrf: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY'
			});
		});

		it('maps voting public keys with epoch status', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				account: {
					address: targetAddress,
					publicKey: 'A'.repeat(64),
					importance: '0',
					mosaics: [],
					supplementalPublicKeys: {
						voting: {
							publicKeys: [
								{
									publicKey: 'B'.repeat(64),
									startEpoch: 11,
									endEpoch: 14
								},
								{
									publicKey: 'C'.repeat(64),
									startEpoch: 4,
									endEpoch: 9
								},
								{
									publicKey: 'A'.repeat(64),
									startEpoch: 8,
									endEpoch: 12
								}
							]
						}
					}
				}
			});
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			makeRequest.mockResolvedValueOnce(chainInfoResponse);
			makeRequest.mockResolvedValueOnce({ accountNames: [] });

			// Act:
			const result = await fetchAccountInfo(targetAddress);

			// Assert:
			expect(result.votingKeys).toEqual([
				{
					publicKey: 'A'.repeat(64),
					startEpoch: 8,
					endEpoch: 12,
					status: 'current'
				},
				{
					publicKey: 'B'.repeat(64),
					startEpoch: 11,
					endEpoch: 14,
					status: 'future'
				},
				{
					publicKey: 'C'.repeat(64),
					startEpoch: 4,
					endEpoch: 9,
					status: 'expired'
				}
			]);
		});

		it('maps activity buckets to importance history', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce({
				account: {
					address: targetAddress,
					publicKey: 'A'.repeat(64),
					importance: '0',
					mosaics: [],
					activityBuckets: [
						{
							startHeight: '1000',
							totalFeesPaid: '12345',
							beneficiaryCount: 2,
							rawScore: '987'
						},
						{
							startHeight: '2000',
							totalFeesPaid: '67890',
							beneficiaryCount: 3,
							rawScore: '654'
						}
					]
				}
			});
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			makeRequest.mockResolvedValueOnce(chainInfoResponse);
			makeRequest.mockResolvedValueOnce({ accountNames: [] });

			// Act:
			const result = await fetchAccountInfo(targetAddress);

			// Assert:
			expect(result.importanceHistory).toEqual([
				{
					recalculationBlock: 1000,
					totalFeesPaid: 12345,
					beneficiaryCount: 2,
					importanceScore: 987
				},
				{
					recalculationBlock: 2000,
					totalFeesPaid: 67890,
					beneficiaryCount: 3,
					importanceScore: 654
				}
			]);
		});

		it('calculates public key account importance using totalChainImportance from network properties', async () => {
			// Arrange:
			const publicKey = 'B'.repeat(64);
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(accountResponse);
			makeRequest.mockResolvedValueOnce(networkPropertiesResponse);
			makeRequest.mockResolvedValueOnce(chainInfoResponse);
			makeRequest.mockResolvedValueOnce({ accountNames: [] });
			makeRequest.mockResolvedValueOnce([
				{
					mosaic: {
						id: '72C0212E67A08BCE',
						ownerAddress: targetAddress,
						divisibility: 6
					}
				}
			]);
			makeRequest.mockResolvedValueOnce({ mosaicNames: [] });

			// Act:
			const result = await fetchAccountInfoByPublicKey(publicKey);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, `/api/symbol-node/accounts/${publicKey}`);
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/network/properties');
			expect(makeRequest).toHaveBeenNthCalledWith(3, '/api/symbol-node/chain/info');
			expect(makeRequest).toHaveBeenNthCalledWith(4, '/api/symbol-node/namespaces/account/names', {
				method: 'POST',
				body: JSON.stringify({
					addresses: [targetAddress]
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(makeRequest).toHaveBeenNthCalledWith(5, '/api/symbol-node/mosaics', {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds: ['72C0212E67A08BCE']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(makeRequest).toHaveBeenNthCalledWith(6, '/api/symbol-node/namespaces/mosaic/names', {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds: ['72C0212E67A08BCE']
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result.importance).toBeCloseTo(82.97194194188367);
			expect(result.namespaces).toEqual([]);
		});
	});
});
