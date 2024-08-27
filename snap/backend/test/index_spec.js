import { onCronjob, onRpcRequest } from '../src/index.js';
import cryptoCompareClient from '../src/services/cryptocompareClient.js';
import statisticsClient from '../src/services/statisticsClient.js';
import symbolClient from '../src/services/symbolClient.js';
import stateManager from '../src/stateManager.js';
import accountUtils from '../src/utils/accountUtils.js';
import mosaicUtils from '../src/utils/mosaicUtils.js';
import transactionUtils from '../src/utils/transactionUtils.js';
import {
	describe, expect, it, jest
} from '@jest/globals';

jest.spyOn(stateManager, 'getState').mockResolvedValue();
jest.spyOn(stateManager, 'update').mockResolvedValue();
jest.spyOn(cryptoCompareClient, 'fetchPrice').mockResolvedValue();
jest.spyOn(statisticsClient, 'getNodeInfo').mockResolvedValue();
global.snap = {
	request: jest.fn()
};

describe('index', () => {
	const runBasicRequestThrowErrorTest = async RequestType => {
		it('throws an error if the requested method does not exist', async () => {
			// Act + Assert:
			await expect(RequestType({
				request: {
					method: 'unknownMethod'
				}
			})).rejects.toThrow('Method not found.');
		});
	};

	describe('onRpcRequest', () => {
		const mockNodeInfo = {
			identifier: 104,
			networkName: 'mainnet',
			url: 'http://localhost:3000'
		};

		const mockCurrencies = {
			USD: 0.25,
			EUR: 0.20
		};

		const mockFeeMultiplier = {
			slow: 0,
			average: 0,
			fast: 0
		};

		beforeEach(() => {
			jest.clearAllMocks();

			stateManager.getState.mockResolvedValue({
				accounts: {},
				network: mockNodeInfo,
				currencies: mockCurrencies,
				feeMultiplier: mockFeeMultiplier
			});
		});

		runBasicRequestThrowErrorTest(onRpcRequest);

		describe('initialSnap', () => {
			const assertInitialSnap = async (state, expectedState) => {
				// Arrange:
				jest.spyOn(symbolClient, 'create').mockReturnValue({
					fetchNetworkCurrencyMosaicId: jest.fn().mockResolvedValue('currencyMosaicId'),
					fetchTransactionFeeMultiplier: jest.fn().mockResolvedValue({
						slow: 100,
						average: 150,
						fast: 200
					}),
					fetchMosaicsInfo: jest.fn().mockResolvedValue({
						currencyMosaicId: {
							divisibility: 6
						}
					}),
					fetchMosaicNamespace: jest.fn().mockResolvedValue({
						currencyMosaicId: ['symbol.xym']
					})
				});

				stateManager.getState.mockResolvedValue(state);
				statisticsClient.getNodeInfo.mockResolvedValue(mockNodeInfo);
				cryptoCompareClient.fetchPrice.mockResolvedValue(mockCurrencies);

				// Act:
				const response = await onRpcRequest({
					request: {
						method: 'initialSnap',
						params: {
							networkName: 'mainnet',
							currency: 'USD'
						}
					}
				});

				// Assert:
				expect(response).toStrictEqual(expectedState);
			};

			it('returns basic snap states', async () => {
				await assertInitialSnap(null, {
					accounts: {},
					currencies: mockCurrencies,
					network: {
						...mockNodeInfo,
						currencyMosaicId: 'currencyMosaicId'
					},
					currency: {
						symbol: 'USD',
						price: 0.25
					},
					mosaicInfo: {
						currencyMosaicId: {
							divisibility: 6,
							networkName: 'mainnet',
							name: ['symbol.xym']
						}
					},
					feeMultiplier: {
						slow: 100,
						average: 150,
						fast: 200
					}
				});
			});

			it('returns snap states with accounts', async () => {
				// Arrange:
				const state = {
					accounts: {
						'0x1': {
							account: {
								id: '0x1',
								address: 'address',
								label: 'Primary Account',
								networkName: 'mainnet'
							},
							privateKey: 'private key'
						},
						'0x2': {
							account: {
								id: '0x2',
								address: 'address',
								label: 'Primary Account',
								networkName: 'testnet'
							},
							privateKey: 'private key'
						}
					},
					network: mockNodeInfo,
					mosaicInfo: {}
				};

				await assertInitialSnap(state, {
					accounts: {
						'0x1': {
							id: '0x1',
							address: 'address',
							label: 'Primary Account',
							networkName: 'mainnet'
						}
					},
					network: {
						...mockNodeInfo,
						currencyMosaicId: 'currencyMosaicId'
					},
					currencies: mockCurrencies,
					currency: {
						symbol: 'USD',
						price: 0.25
					},
					mosaicInfo: {
						currencyMosaicId: {
							divisibility: 6,
							networkName: 'mainnet',
							name: ['symbol.xym']
						}
					},
					feeMultiplier: {
						slow: 100,
						average: 150,
						fast: 200
					}
				});
			});
		});

		describe('createAccount', () => {
			it('returns new created account', async () => {
				// Arrange:
				jest.spyOn(accountUtils, 'createAccount').mockResolvedValue();

				// Act:
				await onRpcRequest({
					request: {
						method: 'createAccount',
						params: {
							accountLabel: 'my wallet'
						}
					}
				});

				// Assert:
				expect(accountUtils.createAccount).toHaveBeenCalledWith({
					state: {
						accounts: {},
						network: mockNodeInfo,
						currencies: mockCurrencies,
						feeMultiplier: mockFeeMultiplier
					},
					requestParams: {
						accountLabel: 'my wallet'
					}
				});
			});
		});

		describe('importAccount', () => {
			it('returns new import account', async () => {
				// Arrange:
				jest.spyOn(accountUtils, 'importAccount').mockResolvedValue();

				// Act:
				await onRpcRequest({
					request: {
						method: 'importAccount',
						params: {
							accountLabel: 'my wallet',
							privateKey: 'private key'
						}
					}
				});

				// Assert:
				expect(accountUtils.importAccount).toHaveBeenCalledWith({
					state: {
						accounts: {},
						currencies: mockCurrencies,
						network: mockNodeInfo,
						feeMultiplier: mockFeeMultiplier
					},
					requestParams: {
						accountLabel: 'my wallet',
						privateKey: 'private key'
					}
				});
			});
		});

		describe('getNetwork', () => {
			it('returns the current network', async () => {
				// Act:
				const response = await onRpcRequest({
					request: {
						method: 'getNetwork'
					}
				});

				// Assert:
				expect(response).toStrictEqual(mockNodeInfo);
			});
		});

		describe('switchNetwork', () => {
			it('switches the network', async () => {
				// Arrange:
				const mockCurrencyMosaicId = 'mosaicId';
				const mockExpectedNodeInfo = {
					identifier: 152,
					networkName: 'testnet',
					url: 'http://localhost:3000',
					currencyMosaicId: mockCurrencyMosaicId
				};

				statisticsClient.getNodeInfo.mockResolvedValue(mockExpectedNodeInfo);

				jest.spyOn(symbolClient, 'create').mockReturnValue({
					fetchNetworkCurrencyMosaicId: jest.fn().mockResolvedValue(mockCurrencyMosaicId)
				});

				// Act:
				const response = await onRpcRequest({
					request: {
						method: 'switchNetwork',
						params: {
							networkName: 'testnet'
						}
					}
				});

				// Assert:
				expect(response).toStrictEqual(mockExpectedNodeInfo);
			});
		});

		describe('getCurrency', () => {
			it('returns the currency given by symbol', async () => {
				// Arrange + Act:
				const response = await onRpcRequest({
					request: {
						method: 'getCurrency',
						params: {
							currency: 'USD'
						}
					}
				});

				// Assert:
				expect(response).toStrictEqual({
					symbol: 'USD',
					price: 0.25
				});
			});
		});

		const assertMethodCalled = async (func, method, request, expectedParams) => {
			// Arrange:
			jest.spyOn(func, method).mockReturnValue();
			stateManager.getState.mockResolvedValue({});

			// Act:
			await onRpcRequest({
				request
			});

			// Assert:
			expect(func[method]).toHaveBeenCalledWith(expectedParams);
		};

		describe('getAccounts', () => {
			it('should invoke accountUtils.getAccounts with the correct parameters', async () => {
				await assertMethodCalled(accountUtils, 'getAccounts', {
					method: 'getAccounts'
				}, {
					state: {},
					requestParams: {}
				});
			});
		});

		describe('getMosaicInfo', () => {
			it('should invoke mosaicUtils.getMosaicInfo with the correct parameters', async () => {
				await assertMethodCalled(mosaicUtils, 'getMosaicInfo', {
					method: 'getMosaicInfo'
				}, {
					state: {},
					requestParams: {}
				});
			});
		});

		describe('fetchAccountMosaics', () => {
			it('should invoke accountUtils.fetchAccountMosaics with the correct parameters', async () => {
				await assertMethodCalled(accountUtils, 'fetchAccountMosaics', {
					method: 'fetchAccountMosaics',
					params: {
						accountIds: ['0x1']
					}
				}, {
					state: {},
					requestParams: {
						accountIds: ['0x1']
					}
				});
			});
		});

		describe('fetchAccountTransactions', () => {
			it('should invoke transactionUtils.fetchAccountTransactions with the correct parameters', async () => {
				await assertMethodCalled(transactionUtils, 'fetchAccountTransactions', {
					method: 'fetchAccountTransactions',
					params: {
						address: 'address',
						offsetId: ''
					}
				}, {
					state: {},
					requestParams: {
						address: 'address',
						offsetId: ''
					}
				});
			});
		});

		describe('getFeeMultiplier', () => {
			it('returns state fee multiplier', async () => {
				// Act:
				const response = await onRpcRequest({
					request: {
						method: 'getFeeMultiplier'
					}
				});

				// Assert:
				expect(response).toStrictEqual(mockFeeMultiplier);
			});
		});

		describe('signTransferTransaction', () => {
			it('should invoke accountUtils.signTransferTransaction with the correct parameters', async () => {
				// Arrange:
				const mockParams = {
					accountId: '0x1',
					recipient: 'address',
					mosaics: [],
					message: 'message',
					feeMultiplier: 'slow'
				};

				await assertMethodCalled(accountUtils, 'signTransferTransaction', {
					method: 'signTransferTransaction',
					params: mockParams
				}, {
					state: {},
					requestParams: mockParams
				});
			});
		});
	});

	describe('onCronjob', () => {
		runBasicRequestThrowErrorTest(onCronjob);

		describe('fetchCurrencyPrice', () => {
			it('fetches latest currency price and update state', async () => {
				// Arrange:
				const state = {
					currencies: {
						USD: 0.25,
						JPY: 0.20
					}
				};

				const mockLatestCurrencies = {
					USD: 1.00,
					JPY: 2.00
				};

				stateManager.getState.mockResolvedValue(state);
				cryptoCompareClient.fetchPrice.mockResolvedValue(mockLatestCurrencies);

				// Act:
				await onCronjob({
					request: {
						method: 'fetchCurrencyPrice'
					}
				});

				// Assert:
				expect(stateManager.update).toHaveBeenCalledWith({
					currencies: mockLatestCurrencies
				});
			});
		});

		describe('fetchFeeMultiplier', () => {
			it('fetches latest fee multiplier and update state', async () => {
				// Arrange:
				const state = {
					feeMultiplier: {
						slow: 0,
						average: 0,
						fast: 0
					}
				};

				stateManager.getState.mockResolvedValue(state);

				jest.spyOn(transactionUtils, 'getFeeMultiplier').mockResolvedValue({
					slow: 100,
					average: 150,
					fast: 200
				});

				// Act:
				await onCronjob({
					request: {
						method: 'fetchFeeMultiplier'
					}
				});

				// Assert:
				expect(transactionUtils.getFeeMultiplier).toHaveBeenCalledWith({
					state
				});
			});
		});
	});
});
