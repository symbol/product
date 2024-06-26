import stateManager from '../../src/stateManager.js';
import accountUtils from '../../src/utils/accountUtils.js';
import {
	beforeEach,
	describe, expect, it, jest
} from '@jest/globals';
import {
	copyable, heading, panel, text
} from '@metamask/snaps-sdk';
import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';
import { v4 as uuidv4 } from 'uuid';

global.snap = {
	request: jest.fn()
};

jest.spyOn(stateManager, 'update').mockResolvedValue();

describe('accountUtils', () => {
	const generateAccounts = (numberOfAccounts, networkName) => {
		const accounts = {};
		const facade = new SymbolFacade(networkName);

		for (let index = 0; index < numberOfAccounts; index++) {
			const accountId = uuidv4();
			const privateKey = PrivateKey.random();
			const keyPair = new SymbolFacade.KeyPair(privateKey);

			accounts[accountId] = {
				account: {
					id: accountId,
					addressIndex: index,
					type: 'metamask',
					networkName,
					label: `Wallet ${index}`,
					address: facade.network.publicKeyToAddress(keyPair.publicKey).toString(),
					publicKey: keyPair.publicKey.toString()
				},
				privateKey
			};
		}

		return accounts;
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('deriveKeyPair', () => {
		const generateMockBip44Entropy = networkName => {
			const facade = new SymbolFacade(networkName);
			const coinType = facade.bip32Path(0)[1];

			return {
				chainCode: '0x90d3d16b776e542d7b1888e502292fc7b18e91f69be869f33a07f95068ae6e6a',
				coin_type: coinType,
				index: 1,
				masterFingerprint: 0,
				parentFingerprint: 1,
				depth: 2,
				path: `m / bip32:44' / bip32:${coinType}'`,
				privateKey: '0x1f53ba3da42800d092a0c331a20a41acce81d2dd6f710106953ada277c502010',
				publicKey: '0xf2195f2bce44400c76e4a03536e66d9b46840d042e6548e90a5f4d653d7aa133f6'
					+ '2c18ca655eb4366e59088b3815867535e7ce6ca70baf6507c047a4b7637e5cc6'
			};
		};

		const assertDeriveKeyPair = async (networkName, expectedCoinType) => {
			// Arrange:
			const mockRequest = jest.fn();

			global.snap = { request: mockRequest };

			global.snap.request.mockResolvedValue(generateMockBip44Entropy(networkName));

			// Act:
			const keyPair = await accountUtils.deriveKeyPair(networkName, 0);

			// Assert:
			expect(mockRequest).toHaveBeenCalledWith({
				method: 'snap_getBip44Entropy',
				params: {
					coinType: expectedCoinType
				}
			});
			expect(keyPair).toBeInstanceOf(SymbolFacade.KeyPair);
		};

		it('can derive key pair with mainnet network', async () => {
			await assertDeriveKeyPair('mainnet', 4343);
		});

		it('can derive key pair with testnet network', async () => {
			await assertDeriveKeyPair('testnet', 1);
		});
	});

	describe('getLatestAccountIndex', () => {
		const assertLatestAccountIndex = (accounts, networkName, expectedIndex) => {
			// Act:
			const index = accountUtils.getLatestAccountIndex(accounts, networkName);

			// Assert:
			expect(index).toBe(expectedIndex);
		};

		it('returns -1 when no accounts are found', () => {
			// Arrange:
			const accounts = {};

			assertLatestAccountIndex(accounts, 'testnet', -1);
		});

		it('returns the latest account index when accounts are found with testnet', () => {
			// Arrange:
			const accounts = {
				...generateAccounts(3, 'testnet'),
				...generateAccounts(5, 'mainnet')
			};

			assertLatestAccountIndex(accounts, 'testnet', 2);
		});

		it('returns the latest account index when accounts are found with mainnet', () => {
			// Arrange:
			const accounts = {
				...generateAccounts(5, 'testnet'),
				...generateAccounts(3, 'mainnet')
			};

			assertLatestAccountIndex(accounts, 'mainnet', 2);
		});
	});

	describe('getAccounts', () => {
		const assertAccountsByNetwork = (state, mockAccounts) => {
			// Act:
			const accounts = accountUtils.getAccounts({ state });

			// Assert:
			const expectedAccounts = Object.values(mockAccounts).reduce((acc, { account }) => {
				acc[account.id] = account;
				return acc;
			}, {});

			expect(accounts).toStrictEqual(expectedAccounts);
		};

		it('returns accounts given testnet network', () => {
			// Arrange:
			const mockAccounts = generateAccounts(3, 'testnet');
			const state = {
				network: {
					networkName: 'testnet'
				},
				accounts: {
					...mockAccounts,
					...generateAccounts(5, 'mainnet')
				}
			};

			assertAccountsByNetwork(state, mockAccounts);
		});

		it('returns accounts given mainnet network', () => {
			// Arrange:
			const mockAccounts = generateAccounts(5, 'mainnet');
			const state = {
				network: {
					networkName: 'mainnet'
				},
				accounts: {
					...mockAccounts,
					...generateAccounts(3, 'testnet')
				}
			};

			assertAccountsByNetwork(state, mockAccounts);
		});
	});

	describe('findAccountByPrivateKey', () => {
		const privateKey = '1F53BA3DA42800D092A0C331A20A41ACCE81D2DD6F710106953ADA277C502010';

		const assertFindAccountByPrivateKey = (accounts, expectedResult) => {
			// Act:
			const account = accountUtils.findAccountByPrivateKey(accounts, privateKey);

			// Assert:
			expect(account).toStrictEqual(expectedResult);
		};

		it('returns account given private key', () => {
			// Arrange:
			const accounts = {
				'0x1234': {
					account: {
						id: '0x1234',
						addressIndex: 0,
						type: 'metamask',
						networkName: 'testnet',
						label: 'Wallet 0',
						address: 'address 0',
						publicKey: 'public key 0'
					},
					privateKey
				}
			};

			assertFindAccountByPrivateKey(accounts, accounts['0x1234']);
		});

		it('returns undefined when account not found', () => {
			// Arrange:
			const accounts = {};

			assertFindAccountByPrivateKey(accounts, undefined);
		});
	});

	describe('createAccount', () => {
		// Arrange:
		const privateKey = '1F53BA3DA42800D092A0C331A20A41ACCE81D2DD6F710106953ADA277C502010';
		const keyPair = new SymbolFacade.KeyPair(new PrivateKey(privateKey));

		const assertCreateAccount = async (state, requestParams, expectedAddressIndex) => {
			// Arrange:
			jest.spyOn(accountUtils, 'deriveKeyPair').mockResolvedValue(keyPair);

			// Act:
			const account = await accountUtils.createAccount({ state, requestParams });

			// Assert:
			expect(stateManager.update).toHaveBeenCalledWith({
				...state,
				accounts: {
					...state.accounts,
					[account.id]: {
						account,
						privateKey
					}
				}
			});

			expect(account).toStrictEqual({
				id: expect.any(String),
				addressIndex: expectedAddressIndex,
				type: 'metamask',
				networkName: 'testnet',
				label: requestParams.accountLabel,
				address: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
				publicKey: 'FABAD1271A72816961B95CCCAAE1FD1E356F26A6AD3E0A91A25F703C1312F73D'
			});
		};

		it('creates a first account if latest account index return not found', async () => {
			// Arrange:
			const state = {
				network: {
					networkName: 'testnet'
				},
				accounts: {}
			};

			const requestParams = {
				accountLabel: 'my first wallet'
			};

			await assertCreateAccount(state, requestParams, 0);
		});

		it('creates a new account with a new address index', async () => {
			// Arrange:
			const state = {
				network: {
					networkName: 'testnet'
				},
				accounts: {
					...generateAccounts(3, 'testnet'),
					...generateAccounts(5, 'mainnet')
				}
			};

			const requestParams = {
				accountLabel: 'invest wallet'
			};

			await assertCreateAccount(state, requestParams, 3);
		});

		it('throws an error when network name invalid', async () => {
			// Arrange:
			const state = {
				network: {
					networkName: 'testnet1'
				},
				accounts: {}
			};

			const requestParams = {
				accountLabel: 'my first wallet'
			};

			// Act + Assert:
			const errorMessage = 'Failed to create account: no network found with name \'testnet1\'';
			await expect(accountUtils.createAccount({ state, requestParams })).rejects.toThrow(errorMessage);
		});

		it('throws an error when failed to derive key pair', async () => {
			// Arrange:
			const state = {
				network: {
					networkName: 'testnet'
				},
				accounts: {}
			};

			const requestParams = {
				accountLabel: 'my first wallet'
			};

			jest.spyOn(accountUtils, 'deriveKeyPair').mockRejectedValue(new Error('error'));

			// Act + Assert:
			const errorMessage = 'Failed to create account: error';
			await expect(accountUtils.createAccount({ state, requestParams })).rejects.toThrow(errorMessage);
		});
	});

	describe('importAccount', () => {
		it('can import an account', async () => {
			// Arrange:
			const state = {
				network: {
					networkName: 'testnet'
				},
				accounts: {}
			};

			const requestParams = {
				privateKey: '1F53BA3DA42800D092A0C331A20A41ACCE81D2DD6F710106953ADA277C502010',
				accountLabel: 'import account'
			};

			const mockRequest = jest.fn();

			global.snap = { request: mockRequest };

			global.snap.request.mockResolvedValue(true);

			// Act:
			const account = await accountUtils.importAccount({ state, requestParams });

			// Assert:
			expect(mockRequest).toHaveBeenCalledWith({
				method: 'snap_dialog',
				params: {
					type: 'confirmation',
					content: panel([
						heading('Import account'),
						heading('Address:'),
						copyable('TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y'),
						heading('Public Key:'),
						copyable('FABAD1271A72816961B95CCCAAE1FD1E356F26A6AD3E0A91A25F703C1312F73D')
					])
				}
			});

			expect(stateManager.update).toHaveBeenCalledWith({
				...state,
				accounts: {
					...state.accounts,
					[account.id]: {
						account,
						privateKey: requestParams.privateKey
					}
				}
			});

			expect(account).toStrictEqual({
				id: expect.any(String),
				addressIndex: null,
				type: 'import',
				networkName: 'testnet',
				label: requestParams.accountLabel,
				address: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
				publicKey: 'FABAD1271A72816961B95CCCAAE1FD1E356F26A6AD3E0A91A25F703C1312F73D'
			});
		});

		it('can not import an account if private key already exists', async () => {
			// Arrange:
			const state = {
				network: {
					networkName: 'testnet'
				},
				accounts: {
					'0x1234': {
						account: {
							id: '0x1234',
							addressIndex: null,
							type: 'import',
							networkName: 'testnet',
							label: 'import account',
							address: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
							publicKey: 'FABAD1271A72816961B95CCCAAE1FD1E356F26A6AD3E0A91A25F703C1312F73D'
						},
						privateKey: '1F53BA3DA42800D092A0C331A20A41ACCE81D2DD6F710106953ADA277C502010'
					}
				}
			};

			const requestParams = {
				privateKey: '1F53BA3DA42800D092A0C331A20A41ACCE81D2DD6F710106953ADA277C502010',
				accountLabel: 'import account'
			};

			const mockRequest = jest.fn();

			global.snap = { request: mockRequest };

			// Act:
			const existingAccount = await accountUtils.importAccount({ state, requestParams });

			// Assert:
			expect(mockRequest).toHaveBeenCalledWith({
				method: 'snap_dialog',
				params: {
					type: 'alert',
					content: panel([
						heading('Import account'),
						text('Account already exists.')
					])
				}
			});
			expect(existingAccount).toStrictEqual(state.accounts['0x1234'].account);
		});

		it('throws an error when private key is empty', async () => {
			// Arrange:
			const state = {
				network: {
					networkName: 'testnet'
				},
				accounts: {}
			};

			const requestParams = {
				privateKey: '',
				accountLabel: 'import account'
			};

			// Act + Assert:
			const errorMessage = 'Failed to import account: bytes was size 0 but must be 32';
			await expect(accountUtils.importAccount({ state, requestParams })).rejects.toThrow(errorMessage);
		});
	});
});
