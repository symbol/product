import { onCronjob, onRpcRequest } from '../src/index.js';
import cryptoCompareClient from '../src/services/cryptocompareClient.js';
import statisticsClient from '../src/services/statisticsClient.js';
import stateManager from '../src/stateManager.js';
import accountUtils from '../src/utils/accountUtils.js';
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

		beforeEach(() => {
			jest.clearAllMocks();

			stateManager.getState.mockResolvedValue({
				accounts: {},
				network: mockNodeInfo,
				currencies: mockCurrencies
			});
		});

		runBasicRequestThrowErrorTest(onRpcRequest);

		describe('initialSnap', () => {
			const assertInitialSnap = async (state, expectedState) => {
				// Arrange:
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
					network: mockNodeInfo,
					currency: {
						symbol: 'USD',
						price: 0.25
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
					network: mockNodeInfo
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
					network: mockNodeInfo,
					currencies: mockCurrencies,
					currency: {
						symbol: 'USD',
						price: 0.25
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
						currencies: mockCurrencies
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
						network: mockNodeInfo
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
				const mockExpectedNodeInfo = {
					identifier: 152,
					networkName: 'testnet',
					url: 'http://localhost:3000'
				};

				statisticsClient.getNodeInfo.mockResolvedValue(mockExpectedNodeInfo);

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

			it('throws an error if the requested method does not exist', async () => {
				// Act + Assert:
				await expect(onCronjob({
					request: {
						method: 'unknownMethod'
					}
				})).rejects.toThrow('Method not found.');
			});
		});
	});
});
