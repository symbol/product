import symbolClient from '../../src/services/symbolClient.js';
import stateManager from '../../src/stateManager.js';
import accountUtils from '../../src/utils/accountUtils.js';
import mosaicUtils from '../../src/utils/mosaicUtils.js';
import {
	beforeEach,
	describe, expect, it, jest
} from '@jest/globals';
import {
	copyable, heading, panel, text
} from '@metamask/snaps-sdk';
import { PrivateKey, utils } from 'symbol-sdk';
import { NetworkTimestamp, SymbolFacade } from 'symbol-sdk/symbol';
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
					publicKey: keyPair.publicKey.toString(),
					mosaics: []
				},
				privateKey: privateKey.toString()
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

		const assertCreateAccount = async (state, requestParams, mockMosaics, expectedResult) => {
			// Arrange:
			jest.spyOn(accountUtils, 'deriveKeyPair').mockResolvedValue(keyPair);
			jest.spyOn(accountUtils, 'fetchAndUpdateAccountMosaics').mockResolvedValue(mockMosaics);

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
				addressIndex: expectedResult.addressIndex,
				type: 'metamask',
				networkName: 'testnet',
				label: requestParams.accountLabel,
				address: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
				publicKey: 'FABAD1271A72816961B95CCCAAE1FD1E356F26A6AD3E0A91A25F703C1312F73D',
				mosaics: expectedResult.mosaics
			});
			expect(accountUtils.fetchAndUpdateAccountMosaics).toHaveBeenCalledWith(state, [account.address]);
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

			await assertCreateAccount(state, requestParams, {}, { addressIndex: 0, mosaics: [] });
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

			await assertCreateAccount(state, requestParams, {}, { addressIndex: 3, mosaics: [] });
		});

		it('create new account with sort XYM mosaic to first place', async () => {
			// Arrange:
			const state = {
				network: {
					networkName: 'testnet',
					currencyMosaicId: 'mosaicXYMId'
				},
				accounts: {
					...generateAccounts(3, 'testnet'),
					...generateAccounts(5, 'mainnet')
				}
			};

			const requestParams = {
				accountLabel: 'invest wallet'
			};

			const mockMosaicsResponse = {
				TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y: [
					{
						id: 'mosaicId',
						amount: 1000
					},
					{
						id: 'mosaicXYMId',
						amount: 1000
					}
				]
			};

			await assertCreateAccount(state, requestParams, mockMosaicsResponse, {
				addressIndex: 3,
				mosaics: [
					{
						id: 'mosaicXYMId',
						amount: 1000
					},
					{
						id: 'mosaicId',
						amount: 1000
					}
				]
			});
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
		const assertCanImportAccount = async (state, requestParams, mockAccountMosaicsResponse, expectedResult) => {
			// Arrange:
			const mockRequest = jest.fn();

			global.snap = { request: mockRequest };

			global.snap.request.mockResolvedValue(true);

			jest.spyOn(accountUtils, 'fetchAndUpdateAccountMosaics').mockResolvedValue(mockAccountMosaicsResponse);

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

			expect(accountUtils.fetchAndUpdateAccountMosaics).toHaveBeenCalledWith(state, [account.address]);

			expect(account).toStrictEqual({
				id: expect.any(String),
				addressIndex: null,
				type: 'import',
				networkName: 'testnet',
				label: expectedResult.label,
				address: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
				publicKey: 'FABAD1271A72816961B95CCCAAE1FD1E356F26A6AD3E0A91A25F703C1312F73D',
				mosaics: expectedResult.mosaics
			});
		};

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

			await assertCanImportAccount(state, requestParams, {}, {
				label: 'import account',
				mosaics: []
			});
		});

		it('can import an account with sort XYM mosaics', async () => {
			// Arrange:
			const state = {
				network: {
					networkName: 'testnet',
					currencyMosaicId: 'mosaicXYMId'
				},
				accounts: {}
			};

			const requestParams = {
				privateKey: '1F53BA3DA42800D092A0C331A20A41ACCE81D2DD6F710106953ADA277C502010',
				accountLabel: 'import account'
			};

			const mockAccountMosaicsResponse = {
				TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y: [
					{
						id: 'mosaicId',
						amount: 1000
					},
					{
						id: 'mosaicXYMId',
						amount: 1000
					}
				]
			};

			await assertCanImportAccount(state, requestParams, mockAccountMosaicsResponse, {
				label: 'import account',
				mosaics: [
					{
						id: 'mosaicXYMId',
						amount: 1000
					},
					{
						id: 'mosaicId',
						amount: 1000
					}
				]
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

	describe('fetchAndUpdateAccountMosaics', () => {
		it('fetches account mosaic and updates mosaic info', async () => {
			// Arrange:
			const state = {
				network: {
					networkName: 'testnet',
					currencyMosaicId: 'mosaicXYMId'
				},
				accounts: generateAccounts(1, 'testnet')
			};

			const { account } = Object.values(state.accounts)[0];

			const mockMosaicsResponse = {
				[account.address]: [
					{
						id: 'mosaicId',
						amount: 1000
					},
					{
						id: 'mosaicXYMId',
						amount: 1000
					}
				]
			};

			jest.spyOn(accountUtils, 'fetchAndUpdateAccountMosaics').mockRestore();

			const mockFetchAccountsMosaics = jest.fn().mockResolvedValue(mockMosaicsResponse);
			jest.spyOn(symbolClient, 'create').mockImplementation(() => ({
				fetchAccountsMosaics: mockFetchAccountsMosaics
			}));
			jest.spyOn(mosaicUtils, 'updateMosaicInfo').mockImplementation();

			// Act:
			const result = await accountUtils.fetchAndUpdateAccountMosaics(state, [account.address]);

			// Assert:
			expect(mockFetchAccountsMosaics).toHaveBeenCalledWith([account.address]);
			expect(mosaicUtils.updateMosaicInfo).toHaveBeenCalledWith(
				state,
				['mosaicId', 'mosaicXYMId']
			);
			expect(result).toStrictEqual(mockMosaicsResponse);
		});
	});

	describe('updateAccountMosaics', () => {
		// Arrange:
		const state = {
			network: {
				networkName: 'testnet',
				currencyMosaicId: 'mosaicXYMId'
			},
			accounts: generateAccounts(1, 'testnet')
		};

		it('updates account mosaics and sort XYM mosaic if account exist', async () => {
			// Arrange:
			const { account, privateKey } = Object.values(state.accounts)[0];

			const accountIds = [account.id];

			const accountsMosaics = {
				[account.address]: [
					{
						id: 'mosaicId',
						amount: 1000
					},
					{
						id: 'mosaicXYMId',
						amount: 1000
					}
				]
			};

			// Act:
			const result = await accountUtils.updateAccountMosaics(state, accountIds, accountsMosaics);

			// Assert:
			const expectedAccountResult = {
				[account.id]: {
					account: {
						...account,
						mosaics: [
							{
								id: 'mosaicXYMId',
								amount: 1000
							},
							{
								id: 'mosaicId',
								amount: 1000
							}
						]
					},
					privateKey
				}
			};

			expect(stateManager.update).toHaveBeenCalledWith({
				...state,
				accounts: {
					...expectedAccountResult
				}
			});
			expect(result).toStrictEqual({
				...expectedAccountResult
			});
		});

		it('skip updating account mosaics if account not exist', async () => {
			// Arrange:
			const accountIds = ['0x1234'];

			const accountsMosaics = {
				TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y: [
					{
						id: 'mosaicId',
						amount: 1000
					},
					{
						id: 'mosaicXYMId',
						amount: 1000
					}
				]
			};

			// Act:
			const result = await accountUtils.updateAccountMosaics(state, accountIds, accountsMosaics);

			// Assert:
			expect(stateManager.update).not.toHaveBeenCalled();
			expect(result).toStrictEqual({});
		});
	});

	describe('fetchAccountMosaics', () => {
		// Arrange:
		const state = {
			network: {
				networkName: 'testnet',
				currencyMosaicId: 'mosaicXYMId'
			},
			accounts: generateAccounts(1, 'testnet')
		};

		it('fetches and updates account mosaics', async () => {
			// Arrange:
			const { account, privateKey } = Object.values(state.accounts)[0];

			const requestParams = {
				accountIds: [account.id]
			};

			const mockAccountMosaicsResponse = {
				[account.address]: [
					{
						id: 'mosaicId',
						amount: 1000
					},
					{
						id: 'mosaicXYMId',
						amount: 1000
					}
				]
			};

			jest.spyOn(accountUtils, 'fetchAndUpdateAccountMosaics').mockResolvedValue(mockAccountMosaicsResponse);
			jest.spyOn(accountUtils, 'updateAccountMosaics').mockResolvedValue({
				[account.id]: {
					account,
					privateKey
				}
			});

			// Act:
			const result = await accountUtils.fetchAccountMosaics({ state, requestParams });

			// Assert:
			expect(accountUtils.fetchAndUpdateAccountMosaics).toHaveBeenCalledWith(state, [account.address]);
			expect(accountUtils.updateAccountMosaics).toHaveBeenCalledWith(state, requestParams.accountIds, mockAccountMosaicsResponse);
			expect(result).toStrictEqual({
				[account.id]: account
			});
		});
	});

	describe('signTransferTransaction', () => {
		const state = {
			network: {
				networkName: 'testnet',
				currencyMosaicId: '6BED913FA20223F8'
			},
			accounts: generateAccounts(1, 'testnet'),
			mosaicInfo: {
				'6BED913FA20223F8': {
					divisibility: 6,
					name: ['symbol.xym']
				},
				'500EB0100D000000': {
					divisibility: 2,
					name: []
				}
			},
			feeMultiplier: {
				slow: 1,
				average: 10,
				fast: 100
			}
		};

		it('signs transfer transaction and announce payload', async () => {
			// Arrange:
			const mockRequest = jest.fn();

			global.snap = { request: mockRequest };

			global.snap.request.mockResolvedValue(true);

			const requestParams = {
				accountId: state.accounts[Object.keys(state.accounts)[0]].account.id,
				recipient: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
				mosaics: [
					{
						id: '6BED913FA20223F8',
						amount: 1000
					}
				],
				message: 'transfer message',
				feeMultiplierType: 'slow'
			};

			const mockAnnounceTransaction = jest.fn();

			jest.spyOn(symbolClient, 'create').mockImplementation(() => ({
				announceTransaction: mockAnnounceTransaction
			}));

			// Act:
			await accountUtils.signTransferTransaction({ state, requestParams });

			// Assert:
			const facade = new SymbolFacade('testnet');
			const { payload } = mockAnnounceTransaction.mock.calls[0][0];
			const transactionObject = facade.transactionFactory.static.deserialize(utils.hexToUint8(payload));
			const expectedTransactionObject = facade.transactionFactory.create({
				type: 'transfer_transaction_v1',
				signerPublicKey: state.accounts[Object.keys(state.accounts)[0]].account.publicKey,
				recipientAddress: requestParams.recipient,
				mosaics: [
					{
						mosaicId: BigInt('0x6BED913FA20223F8'),
						amount: BigInt(1000000000)
					}
				],
				message: new TextEncoder('utf-8').encode(requestParams.message),
				deadline: facade.now().addHours(2).timestamp,
				fee: BigInt(192)
			});

			expect(transactionObject.mosaics).toStrictEqual(expectedTransactionObject.mosaics);
			expect(transactionObject.recipientAddress).toStrictEqual(expectedTransactionObject.recipientAddress);
			expect(transactionObject.type).toStrictEqual(expectedTransactionObject.type);
			expect(transactionObject.signerPublicKey).toStrictEqual(expectedTransactionObject.signerPublicKey);
			expect(transactionObject.fee).toStrictEqual(expectedTransactionObject.fee);
			expect(utils.uint8ToHex(transactionObject.message)).toStrictEqual(utils.uint8ToHex(expectedTransactionObject.message));
			expect(mockAnnounceTransaction).toHaveBeenCalled();
		});

		describe('confirmTransaction content', () => {
			const assertSnapDialogContent = async (moreParams, moreExpectedContent) => {
				// Arrange:
				const mockRequest = jest.fn();

				global.snap = { request: mockRequest };

				const requestParams = {
					accountId: state.accounts[Object.keys(state.accounts)[0]].account.id,
					recipient: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
					...moreParams,
					feeMultiplierType: 'slow'
				};

				// Act:
				await accountUtils.signTransferTransaction({ state, requestParams });

				// Assert:
				expect(mockRequest).toHaveBeenCalledWith({
					method: 'snap_dialog',
					params: {
						type: 'confirmation',
						content: panel([
							heading('Do you want to sign this transaction?'),
							heading('testnet'),
							heading('Signer Address:'),
							copyable(`${state.accounts[Object.keys(state.accounts)[0]].account.address}`),
							heading('Recipient Address:'),
							copyable('TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y'),
							...moreExpectedContent
						])
					}
				});
			};

			it('returns snap content', async () => {
				await assertSnapDialogContent({
					mosaics: [
						{
							id: '6BED913FA20223F8',
							amount: 0.01
						},
						{
							id: '500EB0100D000000',
							amount: 2.23
						}
					],
					message: 'transfer message'
				}, [
					heading('Estimated Fee (XYM):'),
					copyable('0.000208'),
					heading('Message:'),
					copyable('transfer message'),
					heading('Mosaics:'),
					copyable('0.01 symbol.xym, 2.23 500EB0100D000000')
				]);
			});

			it('returns snap content without mosaics', async () => {
				await assertSnapDialogContent({
					mosaics: [],
					message: 'transfer message'
				}, [
					heading('Estimated Fee (XYM):'),
					copyable('0.000176'),
					heading('Message:'),
					copyable('transfer message')
				]);
			});

			it('returns snap content without message', async () => {
				await assertSnapDialogContent({
					mosaics: [
						{
							id: '6BED913FA20223F8',
							amount: 0.01
						}
					],
					message: ''
				}, [
					heading('Estimated Fee (XYM):'),
					copyable('0.000176'),
					heading('Mosaics:'),
					copyable('0.01 symbol.xym')
				]);
			});
		});

		it('returns false if user does not confirm the transaction', async () => {
			// Arrange:
			global.snap.request.mockResolvedValue(false);

			const requestParams = {
				accountId: state.accounts[Object.keys(state.accounts)[0]].account.id,
				recipient: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
				mosaics: [
					{
						id: '6BED913FA20223F8',
						amount: 1000
					}
				],
				message: 'transfer message',
				feeMultiplierType: 'slow'
			};

			// Act:
			const result = await accountUtils.signTransferTransaction({ state, requestParams });

			// Assert:
			expect(result).toBe(false);
		});
	});

	describe('signTransaction', () => {
		beforeEach(() => {
			jest.clearAllMocks(); // Reset all mocks before each test
		});

		it('returns transaction hash and json payload after signing transaction', async () => {
			const facade = new SymbolFacade('testnet');
			const privateKey = '25E39DC057C64CFA883D51AD05845DBE67759DE4B992FABF423C050915CC3931';

			const symbolAccount = facade.createAccount(new PrivateKey(privateKey));

			const transferTransaction = facade.transactionFactory.create({
				type: 'transfer_transaction_v1',
				signerPublicKey: symbolAccount.publicKey,
				recipientAddress: 'TDCYZ45MX4IZ7SKEL5UL4ZA7O6KDDUAZZALCA6Y',
				mosaics: [],
				message: [0, ...new TextEncoder('utf-8').encode('transfer message')],
				deadline: new NetworkTimestamp(1000).timestamp,
				fee: BigInt(100000)
			});

			const result = await accountUtils.signTransaction(facade, symbolAccount, transferTransaction);

			expect(result).toStrictEqual({
				jsonPayload: {
					payload: 'B1000000000000000B3F873C3DAD7ECADA3F5EAE0C154AA2AA24AC608352DF2C18163C'
						+ '188DFCA018792AD997E163F7F438E28FA460970DA5994D63118E9FB5B0286D7DD4FAD8'
						+ 'CD0AC9778F04D32AB17298275A37BABC0361D4BB4D1E979DFE59C0DB2C9CA672527400'
						+ '00000001985441A086010000000000E80300000000000098C58CF3ACBF119FC9445F68'
						+ 'BE641F779431D019C816207B1100000000000000007472616E73666572206D657373616765'
				},
				transactionHash: '90A662AA51A8CD6232943BF19DEEA187F07C56E1A769DAC9E71DF79CB9F5C56E'
			});
		});
	});
});
