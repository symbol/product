import { ExternalAccountKeystore, MnemonicKeystore, WalletController } from '../../src';
import { cloneDeep } from '../../src/utils/helper';
import { externalAccounts, externalKeystoreAccounts, networkIdentifiers, seedAccounts, walletAccounts } from '../fixtures/wallet';
import { defaultState, filledState } from '../fixtures/wallet-controller-state';
import { createStorageMock } from '../test-utils/storage';
import { describe, jest } from '@jest/globals';

const createDefaultNetworkProperties = networkIdentifier => ({
	nodeUrl: null,
	nodeUrls: [],
	networkIdentifier,
	chainHeight: null,
	other: {}
});

const defaultParameters = {
	api: {
		account: {
			fetchAccountInfo: jest.fn().mockResolvedValue(null)
		},
		transaction: {
			fetchAccountTransactions: jest.fn().mockResolvedValue([]),
			fetchTransactionStatus: jest.fn().mockResolvedValue({}),
			announceTransaction: jest.fn().mockResolvedValue(),
			announceTransactionBundle: jest.fn().mockResolvedValue()
		},
		network: {
			pingNode: jest.fn().mockResolvedValue(true),
			fetchNetworkInfo: jest.fn().mockResolvedValue({}),
			fetchNodeList: jest.fn().mockResolvedValue([])
		},
		listener: {
			createListener: jest.fn().mockReturnValue({})
		}
	},
	sdk: {
		signTransaction: jest.fn().mockResolvedValue({}),
		signTransactionBundle: jest.fn().mockResolvedValue({}),
		cosignTransaction: jest.fn().mockResolvedValue({}),
		encryptMessage: jest.fn().mockResolvedValue(''),
		decryptMessage: jest.fn().mockResolvedValue(''),
		createPrivateAccount: jest.fn().mockResolvedValue(),
		createPrivateKeysFromMnemonic: jest.fn().mockResolvedValue([])
	},
	persistentStorageInterface: createStorageMock({}),
	secureStorageInterface: createStorageMock({}),
	keystores: [MnemonicKeystore, ExternalAccountKeystore],
	modules: [],
	networkIdentifiers: ['testnet', 'mainnet'],
	createDefaultNetworkProperties
};

const runAccessKeystoreErrorTest = async (type, methodName, args) => {
	// Arrange:
	const walletController = new WalletController({
		...defaultParameters,
		keystores: []
	});
	walletController._state = cloneDeep(filledState);
	const expectedErrorMessage = `Failed to access keystore. "${type}" keystore is not available.`;

	// Act:
	const promise = walletController[methodName](...args);

	// Assert:
	await expect(promise).rejects.toThrow(expectedErrorMessage);
};

export const runAddExistingAccountErrorTest = async (account, methodName, args) => {
	// Arrange:
	const walletController = new WalletController({
		...defaultParameters,
		keystores: []
	});
	const expectedErrorMessage = 'Failed to add account. Account with provided private key already exists';

	// Act:
	const promise = walletController[methodName](...args);

	// Assert:
	await expect(promise).rejects.toThrow(expectedErrorMessage);
};


describe('WalletController', () => {
	let walletController;

	beforeEach(() => {
		walletController = new WalletController(defaultParameters);
	});

	describe('loadCache()', () => {
		const runLoadCacheTest = async (persistentStorageData, expectedState) => {
			// Arrange:
			jest.spyOn(walletController._keystores.mnemonic, 'loadCache')
				.mockResolvedValue();
			jest.spyOn(walletController._persistentStorageRepository, 'getAccounts')
				.mockResolvedValue(persistentStorageData.accounts);
			jest.spyOn(walletController._persistentStorageRepository, 'getAccountInfos')
				.mockResolvedValue(persistentStorageData.accountInfos);
			jest.spyOn(walletController._persistentStorageRepository, 'getSeedAddresses')
				.mockResolvedValue(persistentStorageData.seedAddresses);
			jest.spyOn(walletController._persistentStorageRepository, 'getCurrentAccountPublicKey')
				.mockResolvedValue(persistentStorageData.currentAccountPublicKey);
			jest.spyOn(walletController._persistentStorageRepository, 'getNetworkIdentifier')
				.mockResolvedValue(persistentStorageData.networkIdentifier);
			jest.spyOn(walletController._persistentStorageRepository, 'getNetworkProperties')
				.mockResolvedValue(persistentStorageData.networkProperties);
			jest.spyOn(walletController._persistentStorageRepository, 'getLatestTransactions')
				.mockResolvedValue(persistentStorageData.latestTransactions);
			jest.spyOn(walletController._persistentStorageRepository, 'getSelectedNode')
				.mockResolvedValue(persistentStorageData.selectedNodeUrl);

			// Act:
			await walletController.loadCache();

			// Assert:
			expect(walletController._state).toStrictEqual(expectedState);
			expect(walletController._keystores.mnemonic.loadCache).toHaveBeenCalledTimes(1);
		};

		it('loads cache from empty storage', async () => {
			// Arrange:
			const persistentStorageData = {
				accounts: null,
				accountInfos: null,
				seedAddresses: null,
				currentAccountPublicKey: null,
				networkIdentifier: null,
				networkProperties: null,
				latestTransactions: null,
				selectedNodeUrl: null
			};
			const expectedState = {
				...defaultState,
				isCacheLoaded: true
			};

			// Act & Assert:
			await runLoadCacheTest(persistentStorageData, expectedState);
		});

		it('loads cache from filled storage', async () => {
			// Arrange:
			const state = cloneDeep(filledState);
			const persistentStorageData = {
				accounts: state.walletAccounts,
				accountInfos: state.accountInfos,
				seedAddresses: state.seedAddresses,
				currentAccountPublicKey: state.currentAccountPublicKey,
				networkIdentifier: state.networkIdentifier,
				networkProperties: state.networkProperties,
				latestTransactions: state.latestTransactions,
				selectedNodeUrl: state.selectedNodeUrl
			};
			const expectedState = {
				...cloneDeep(defaultState),
				walletAccounts: state.walletAccounts,
				accountInfos: state.accountInfos,
				seedAddresses: state.seedAddresses,
				currentAccountPublicKey: state.currentAccountPublicKey,
				networkIdentifier: state.networkIdentifier,
				networkProperties: state.networkProperties,
				latestTransactions: state.latestTransactions,
				selectedNodeUrl: state.selectedNodeUrl,
				isCacheLoaded: true
			};

			// Act & Assert:
			await runLoadCacheTest(persistentStorageData, expectedState);
		});
	});

	describe('selectAccount()', () => {
		it('selects an account by public key', async () => {
			// Arrange:
			const accountToSelect = walletAccounts.testnet[1];
			walletController._state = cloneDeep(filledState);

			// Act:
			const selectedAccount = await walletController.selectAccount(accountToSelect.publicKey);
			const { currentAccount } = walletController;

			// Assert:
			expect(selectedAccount).toStrictEqual(accountToSelect);
			expect(currentAccount).toStrictEqual(accountToSelect);
		});

		it('throws an error if account is not found', async () => {
			// Arrange:
			const nonExistentPublicKey = 'NON_EXISTENT_PUBLIC_KEY';
			walletController._state = cloneDeep(filledState);

			// Act & Assert:
			await expect(walletController.selectAccount(nonExistentPublicKey))
				.rejects.toThrow('Failed to select account. Account is missing in the wallet');
		});
	});

	describe('saveMnemonicAndGenerateAccounts()', () => {
		it('throws an error when keystore is not accessible', async () => {
			await runAccessKeystoreErrorTest('mnemonic', 'saveMnemonicAndGenerateAccounts', [{}]);
		});

		it('invokes keystore createWallet method and saves generated accounts to persistent storage', async () => {
			// Arrange:
			const password = 'test password';
			const mnemonic = 'test mnemonic';
			const accountPerNetworkCount = 4;
			const name = 'Seed Account 0';
			const expectedWalletAccounts = {
				mainnet: [seedAccounts.mainnet[0]],
				testnet: [seedAccounts.testnet[0]]
			};
			const expectedSeedAccounts = seedAccounts;
			const expectedSelectedAccount = expectedWalletAccounts.testnet[0];
			walletController._state = cloneDeep(defaultState);
			jest.spyOn(walletController._keystores.mnemonic, 'createWallet').mockResolvedValue();
			jest.spyOn(walletController._keystores.mnemonic, 'getAccounts').mockResolvedValue(seedAccounts);
			jest.spyOn(walletController._persistentStorageRepository, 'setAccounts').mockResolvedValue();
			jest.spyOn(walletController._persistentStorageRepository, 'setSeedAddresses').mockResolvedValue();

			// Act:
			const returnedAccount = await walletController.saveMnemonicAndGenerateAccounts({
				mnemonic,
				accountPerNetworkCount,
				name
			}, password);

			// Assert:
			expect(walletController.accounts).toStrictEqual(expectedWalletAccounts);
			expect(walletController.seedAddresses).toStrictEqual(expectedSeedAccounts);
			expect(walletController.currentAccount).toStrictEqual(expectedSelectedAccount);
			expect(returnedAccount).toStrictEqual(expectedSelectedAccount);
			expect(walletController._keystores.mnemonic.createWallet).toHaveBeenCalledWith(mnemonic, accountPerNetworkCount, password);
			expect(walletController._keystores.mnemonic.getAccounts).toHaveBeenCalledWith();
			expect(walletController._persistentStorageRepository.setAccounts).toHaveBeenCalledWith(expectedWalletAccounts);
			expect(walletController._persistentStorageRepository.setSeedAddresses).toHaveBeenCalledWith(expectedSeedAccounts);
		});
	});

	describe('addSeedAccount()', () => {
		it('throws an error when keystore is not accessible', async () => {
			await runAccessKeystoreErrorTest('mnemonic', 'addSeedAccount', [{}]);
		});

		const password = 'test password';
		const name = 'Seed Account 0';
		const index = 0;
		const networkIdentifier = 'testnet';

		it('throws an error when account is already in the wallet', async () => {
			// Arrange:
			const existingAccount = seedAccounts.testnet[0];
			walletController._state = cloneDeep(defaultState);
			walletController._state.walletAccounts[networkIdentifier] = [existingAccount];
			jest.spyOn(walletController._keystores.mnemonic, 'getSeedAccount').mockResolvedValue(existingAccount);
			jest.spyOn(walletController._persistentStorageRepository, 'getAccounts')
				.mockResolvedValue(walletController._state.walletAccounts);
			jest.spyOn(walletController._persistentStorageRepository, 'setAccounts')
				.mockResolvedValue();

			// Act & Assert:
			await expect(walletController.addSeedAccount({ name, index, networkIdentifier }, password))
				.rejects.toThrow('Failed to add account. Account already exists in the wallet.');
			expect(walletController._keystores.mnemonic.getSeedAccount).toHaveBeenCalledWith(networkIdentifier, index);
			expect(walletController._persistentStorageRepository.setAccounts).not.toHaveBeenCalled();
		});

		it('requests mnemonic account from keystore, adds name, and saves to storage', async () => {
			// Arrange:
			const expectedAddedAccount = {
				...seedAccounts.testnet[0],
				name
			};
			const initialState = cloneDeep(defaultState);
			const expectedWalletAccounts = {
				...initialState.walletAccounts,
				[networkIdentifier]: [expectedAddedAccount]
			};
			walletController._state = initialState;
			jest.spyOn(walletController._keystores.mnemonic, 'getSeedAccount')
				.mockResolvedValue(seedAccounts.testnet[0]);
			jest.spyOn(walletController._persistentStorageRepository, 'getAccounts')
				.mockResolvedValue(walletController._state.walletAccounts);
			jest.spyOn(walletController._persistentStorageRepository, 'setAccounts')
				.mockResolvedValue();

			// Act:
			const returnedAccount = await walletController.addSeedAccount({ name, index, networkIdentifier }, password);

			// Assert:
			expect(returnedAccount).toStrictEqual(expectedAddedAccount);
			expect(walletController._keystores.mnemonic.getSeedAccount)
				.toHaveBeenCalledWith(networkIdentifier, index);
			expect(walletController._persistentStorageRepository.setAccounts)
				.toHaveBeenCalledWith(expectedWalletAccounts);
		});
	});

	describe('addExternalAccount()', () => {
		it('throws an error when keystore is not accessible', async () => {
			await runAccessKeystoreErrorTest('external', 'addExternalAccount', [{}]);
		});

		const password = 'test password';
		const name = 'External Account 0';
		const networkIdentifier = 'testnet';
		const { privateKey, ...externalWalletAccount } = externalKeystoreAccounts.testnet[0];

		it('throws an error when account is already in the wallet', async () => {
			// Arrange:
			const existingAccount = {
				...externalWalletAccount,
				name
			};
			walletController._state = cloneDeep(defaultState);
			walletController._state.walletAccounts[networkIdentifier] = [existingAccount];
			jest.spyOn(walletController._keystores.external, 'addAccount')
				.mockResolvedValue(existingAccount);
			jest.spyOn(walletController._persistentStorageRepository, 'getAccounts')
				.mockResolvedValue(walletController._state.walletAccounts);
			jest.spyOn(walletController._persistentStorageRepository, 'setAccounts')
				.mockResolvedValue();

			// Act & Assert:
			await expect(walletController.addExternalAccount({ name, networkIdentifier, privateKey }, password))
				.rejects.toThrow('Failed to add account. Account already exists in the wallet.');
			expect(walletController._keystores.external.addAccount).toHaveBeenCalledWith(privateKey, networkIdentifier, password);
			expect(walletController._persistentStorageRepository.setAccounts).not.toHaveBeenCalled();
		});

		it('requests external account from keystore, adds name, and saves to storage', async () => {
			// Arrange:
			const expectedAddedAccount = {
				...externalWalletAccount,
				name
			};
			const initialState = cloneDeep(defaultState);
			const expectedWalletAccounts = {
				...initialState.walletAccounts,
				testnet: [expectedAddedAccount]
			};
			walletController._state = initialState;
			jest.spyOn(walletController._keystores.external, 'addAccount')
				.mockResolvedValue(externalWalletAccount);
			jest.spyOn(walletController._persistentStorageRepository, 'getAccounts')
				.mockResolvedValue(walletController._state.walletAccounts);
			jest.spyOn(walletController._persistentStorageRepository, 'setAccounts')
				.mockResolvedValue();

			// Act:
			const returnedAccount = await walletController.addExternalAccount({ name, networkIdentifier, privateKey }, password);

			// Assert:
			expect(returnedAccount).toStrictEqual(expectedAddedAccount);
			expect(walletController._keystores.external.addAccount)
				.toHaveBeenCalledWith(privateKey, networkIdentifier, password);
			expect(walletController._persistentStorageRepository.setAccounts)
				.toHaveBeenCalledWith(expectedWalletAccounts);
		});
	});

	describe('renameAccount()', () => {
		it('renames an account in the wallet', async () => {
			// Arrange:
			walletController._state = cloneDeep(filledState);
			const networkIdentifier = 'testnet';
			const accountToRename = walletController._state.walletAccounts.testnet[0];
			const newName = 'Renamed Account';
			const expectedWalletAccounts = cloneDeep(walletController._state.walletAccounts);
			expectedWalletAccounts[networkIdentifier][0] = {
				...accountToRename,
				name: newName
			};
			jest.spyOn(walletController._persistentStorageRepository, 'getAccounts')
				.mockResolvedValue(walletController._state.walletAccounts);
			jest.spyOn(walletController._persistentStorageRepository, 'setAccounts')
				.mockResolvedValue();

			// Act:
			await walletController.renameAccount({
				networkIdentifier,
				publicKey: accountToRename.publicKey,
				name: newName
			});

			// Assert:
			expect(walletController._persistentStorageRepository.setAccounts).toHaveBeenCalledWith(expectedWalletAccounts);
			expect(walletController._state.walletAccounts).toStrictEqual(expectedWalletAccounts);
		});
	});

	describe('removeAccount()', () => {
		const runRemoveAccountTest = async (
			accountToRemove,
			expectedWalletAccounts,
			shouldRemoveFromExternalKeystore,
			shouldThrowError
		) => {
			// Arrange:
			const password = 'test password';
			walletController._state = cloneDeep(filledState);
			walletController._state.walletAccounts = {
				testnet: [seedAccounts.testnet[0], seedAccounts.testnet[1], externalAccounts.testnet[0]],
				mainnet: [seedAccounts.mainnet[0], seedAccounts.mainnet[1], externalAccounts.mainnet[0]]
			};
			jest.spyOn(walletController._persistentStorageRepository, 'getAccounts')
				.mockResolvedValue(walletController._state.walletAccounts);
			jest.spyOn(walletController._persistentStorageRepository, 'setAccounts')
				.mockResolvedValue();
			jest.spyOn(walletController._keystores.external, 'removeAccount')
				.mockResolvedValue();

			// Act:
			if (shouldThrowError) {
				await expect(walletController.removeAccount({
					networkIdentifier: accountToRemove.networkIdentifier,
					publicKey: accountToRemove.publicKey
				}, password)).rejects.toThrow('Cannot remove the currently selected account');
				return;
			}
			await walletController.removeAccount({
				networkIdentifier: accountToRemove.networkIdentifier,
				publicKey: accountToRemove.publicKey
			}, password);

			// Assert:
			expect(walletController._persistentStorageRepository.setAccounts).toHaveBeenCalledWith(expectedWalletAccounts);
			expect(walletController._state.walletAccounts).toStrictEqual(expectedWalletAccounts);
			if (shouldRemoveFromExternalKeystore) {
				expect(walletController._keystores.external.removeAccount)
					.toHaveBeenCalledWith(accountToRemove.networkIdentifier, accountToRemove.publicKey, password);
			} else {
				expect(walletController._keystores.external.removeAccount)
					.not.toHaveBeenCalled();
			}

		};

		it('removes mnemonic account from the wallet', async () => {
			// Arrange:
			const accountToRemove = seedAccounts.testnet[1];
			const expectedWalletAccounts = {
				testnet: [seedAccounts.testnet[0], externalAccounts.testnet[0]],
				mainnet: [seedAccounts.mainnet[0], seedAccounts.mainnet[1], externalAccounts.mainnet[0]]
			};
			const shouldRemoveFromExternalKeystore = false;
			const shouldThrowError = false;

			// Act & Assert:
			await runRemoveAccountTest(accountToRemove, expectedWalletAccounts, shouldRemoveFromExternalKeystore, shouldThrowError);
		});

		it('removes external account from the wallet', async () => {
			// Arrange:
			const accountToRemove = externalAccounts.testnet[0];
			const expectedWalletAccounts = {
				testnet: [seedAccounts.testnet[0], seedAccounts.testnet[1]],
				mainnet: [seedAccounts.mainnet[0], seedAccounts.mainnet[1], externalAccounts.mainnet[0]]
			};
			const shouldRemoveFromExternalKeystore = true;
			const shouldThrowError = false;

			// Act & Assert:
			await runRemoveAccountTest(accountToRemove, expectedWalletAccounts, shouldRemoveFromExternalKeystore, shouldThrowError);
		});

		it('throws an error if trying to remove the currently selected account', async () => {
			// Arrange:
			const accountToRemove = seedAccounts.testnet[0];
			const expectedWalletAccounts = null;
			const shouldRemoveFromExternalKeystore = false;
			const shouldThrowError = true;

			// Act & Assert:
			await runRemoveAccountTest(accountToRemove, expectedWalletAccounts, shouldRemoveFromExternalKeystore, shouldThrowError);
		});
	});

	describe('changeAccountsOrder()', () => {
		it('changes the order of accounts in the wallet', async () => {
			// Arrange:
			const networkIdentifier = 'testnet';
			const initialState = cloneDeep(filledState);
			walletController._state = initialState;
			const expectedWalletAccounts = {
				testnet: [seedAccounts.testnet[1], seedAccounts.testnet[0]],
				mainnet: [seedAccounts.mainnet[0], seedAccounts.mainnet[1]]
			};
			const newAccountsOrder = [seedAccounts.testnet[1], seedAccounts.testnet[0]];
			jest.spyOn(walletController._persistentStorageRepository, 'getAccounts').mockResolvedValue(initialState.walletAccounts);
			jest.spyOn(walletController._persistentStorageRepository, 'setAccounts').mockResolvedValue();

			// Act:
			await walletController.changeAccountsOrder(
				networkIdentifier,
				newAccountsOrder
			);

			// Assert:
			expect(walletController._persistentStorageRepository.setAccounts).toHaveBeenCalledWith(expectedWalletAccounts);
			expect(walletController._state.walletAccounts).toStrictEqual(expectedWalletAccounts);
		});
	});

	describe('fetchAccountInfo()', () => {
		it('returns empty account info when API returns null', async () => {
			// Arrange:
			const expectedFetchedTimestamp = 123456;
			const networkIdentifier = 'testnet';
			const expectedAccountInfo = {
				fetchedAt: expectedFetchedTimestamp
			};
			walletController._state = cloneDeep(filledState);
			jest.spyOn(walletController._api.account, 'fetchAccountInfo').mockResolvedValue(null);
			jest.spyOn(Date, 'now').mockReturnValue(expectedFetchedTimestamp);

			// Act:
			const accountInfo = await walletController.fetchAccountInfo(networkIdentifier);

			// Assert:
			expect(walletController.currentAccountInfo).toStrictEqual(expectedAccountInfo);
			expect(accountInfo).toStrictEqual(expectedAccountInfo);
			expect(walletController._api.account.fetchAccountInfo)
				.toHaveBeenCalledWith(walletController._state.networkProperties, walletController.currentAccount.address);
		});

		it('returns fetched account info and stores it in the cache', async () => {
			// Arrange:
			const networkIdentifier = 'testnet';
			const baseAccountInfo = {
				balance: 1000,
				vestedBalance: 500,
				harvester: false
			};
			const expectedAccountInfo = {
				...baseAccountInfo,
				fetchedAt: Date.now()
			};
			walletController._state = cloneDeep(filledState);
			jest.spyOn(walletController._api.account, 'fetchAccountInfo').mockResolvedValue(baseAccountInfo);

			// Act:
			const accountInfo = await walletController.fetchAccountInfo(networkIdentifier);

			// Assert:
			expect(walletController.currentAccountInfo).toStrictEqual(expectedAccountInfo);
			expect(accountInfo).toStrictEqual(expectedAccountInfo);
			expect(walletController._api.account.fetchAccountInfo)
				.toHaveBeenCalledWith(walletController._state.networkProperties, walletController.currentAccount.address);
		});
	});

	describe('fetchAccountTransactions()', () => {
		const runFetchTransactionsTest = async (options, shouldCacheTransactions) => {
			// Arrange:
			const networkIdentifier = 'testnet';
			walletController._state = cloneDeep(filledState);
			const expectedReturnedTransactionsByApi = [
				{
					transactionId: '123',
					amount: 100,
					type: 'transfer',
					timestamp: Date.now()
				},
				{
					transactionId: '456',
					amount: 200,
					type: 'transfer',
					timestamp: Date.now()
				}
			];
			const initialWalletTransactions = cloneDeep(walletController._state.latestTransactions);
			const updatedWalletTransactions = cloneDeep(walletController._state.latestTransactions);
			updatedWalletTransactions[networkIdentifier][walletController.currentAccount.publicKey] = [
				...expectedReturnedTransactionsByApi
			];
			const accountPublicKey = walletController.currentAccount.publicKey;
			const initialAccountTransactions = initialWalletTransactions[networkIdentifier][accountPublicKey];
			const updatedAccountTransactions = updatedWalletTransactions[networkIdentifier][accountPublicKey];
			const expectedConfig = {
				group: options.group || 'confirmed',
				pageNumber: options.pageNumber || 1,
				pageSize: options.pageSize || 15,
				filter: options.filter || {}
			};
			jest.spyOn(walletController._persistentStorageRepository, 'getLatestTransactions')
				.mockResolvedValue(walletController._state.latestTransactions);
			jest.spyOn(walletController._persistentStorageRepository, 'setLatestTransactions')
				.mockResolvedValue();
			jest.spyOn(walletController._api.transaction, 'fetchAccountTransactions')
				.mockResolvedValue(expectedReturnedTransactionsByApi);

			// Act:
			const returnedTransactions = await walletController.fetchAccountTransactions(options);

			// Assert:
			if (shouldCacheTransactions) {
				expect(walletController._persistentStorageRepository.setLatestTransactions).toHaveBeenCalledWith(updatedWalletTransactions);
				expect(walletController._state.latestTransactions).toStrictEqual(updatedWalletTransactions);
				expect(walletController.currentAccountLatestTransactions).toStrictEqual(updatedAccountTransactions);
				expect(returnedTransactions).toStrictEqual(updatedAccountTransactions);
			}
			else {
				expect(walletController._persistentStorageRepository.setLatestTransactions).not.toHaveBeenCalled();
				expect(walletController._state.latestTransactions).toStrictEqual(initialWalletTransactions);
				expect(walletController.currentAccountLatestTransactions).toStrictEqual(initialAccountTransactions);
				expect(returnedTransactions).toStrictEqual(updatedAccountTransactions);
			}

			expect(walletController._api.transaction.fetchAccountTransactions)
				.toHaveBeenCalledWith(walletController._state.networkProperties, walletController.currentAccount, expectedConfig);
		};

		it('returns transactions and stores them in the cache', async () => {
			// Arrange:
			const options = {};
			const shouldCacheTransactions = true;

			// Act & Assert:
			await runFetchTransactionsTest(options, shouldCacheTransactions);
		});

		it('returns transactions without caching them when filter activated', async () => {
			// Arrange:
			const options = { filter: { type: 'transfer' } };
			const shouldCacheTransactions = false;

			// Act & Assert:
			await runFetchTransactionsTest(options, shouldCacheTransactions);
		});

		it('returns transactions without caching them when group is not confirmed', async () => {
			// Arrange:
			const options = { group: 'unconfirmed' };
			const shouldCacheTransactions = false;

			// Act & Assert:
			await runFetchTransactionsTest(options, shouldCacheTransactions);
		});

		it('returns transactions without caching them when page number is not 1', async () => {
			// Arrange:
			const options = { pageNumber: 2 };
			const shouldCacheTransactions = false;

			// Act & Assert:
			await runFetchTransactionsTest(options, shouldCacheTransactions);
		});
	});

	describe('other network API proxy methods', () => {
		const apiMethodsTestConfig = [
			{
				controllerMethodName: 'fetchTransactionStatus',
				controllerMethodArguments: ['hash-123'],
				apiNamespaceName: 'transaction',
				apiMethodName: 'fetchTransactionStatus'
			},
			{
				controllerMethodName: 'announceSignedTransaction',
				controllerMethodArguments: ['signed-transaction-object', 'group'],
				apiNamespaceName: 'transaction',
				apiMethodName: 'announceTransaction'
			},
			{
				controllerMethodName: 'announceSignedTransactionBundle',
				controllerMethodArguments: ['signed-transaction-bundle-object', 'group'],
				apiNamespaceName: 'transaction',
				apiMethodName: 'announceTransactionBundle'
			}
		];
		const runNetworkApiProxyTests = async config => {
			// Arrange:
			const { controllerMethodName, controllerMethodArguments, apiNamespaceName, apiMethodName } = config;
			describe(`${controllerMethodName}()`, () => {
				it(`calls api.${apiNamespaceName}.${apiMethodName}() with correct arguments`, async () => {
					walletController._state = cloneDeep(filledState);
					const expectedReturnValue = { data: 'test data' };
					jest.spyOn(walletController._api[apiNamespaceName], apiMethodName)
						.mockResolvedValue(expectedReturnValue);

					// Act:
					const result = await walletController[controllerMethodName](...controllerMethodArguments);

					// Assert:
					expect(result).toStrictEqual(expectedReturnValue);
					expect(walletController._api[apiNamespaceName][apiMethodName])
						.toHaveBeenCalledWith(walletController._state.networkProperties, ...controllerMethodArguments);
				});
			});
		};

		apiMethodsTestConfig.forEach(runNetworkApiProxyTests);
	});


	describe('getMnemonic()', () => {
		it('throws an error when keystore is not accessible', async () => {
			await runAccessKeystoreErrorTest('mnemonic', 'getMnemonic', []);
		});

		it('returns mnemonic from the keystore', async () => {
			// Arrange:
			const expectedMnemonic = 'test mnemonic';
			walletController._state = cloneDeep(filledState);
			jest.spyOn(walletController._keystores.mnemonic, 'getMnemonic').mockResolvedValue(expectedMnemonic);

			// Act:
			const mnemonic = await walletController.getMnemonic();

			// Assert:
			expect(mnemonic).toBe(expectedMnemonic);
			expect(walletController._keystores.mnemonic.getMnemonic).toHaveBeenCalledWith();
		});
	});

	describe('getCurrentAccountPrivateKey()', () => {
		it('throws an error when keystore is not accessible', async () => {
			await runAccessKeystoreErrorTest('mnemonic', 'getCurrentAccountPrivateKey', []);
		});

		it('returns current account private key from the keystore', async () => {
			// Arrange:
			const expectedPrivateKey = 'test private key';
			walletController._state = cloneDeep(filledState);
			jest.spyOn(walletController._keystores.mnemonic, 'getPrivateKey').mockResolvedValue(expectedPrivateKey);
			const { currentAccount } = walletController;

			// Act:
			const privateKey = await walletController.getCurrentAccountPrivateKey();

			// Assert:
			expect(privateKey).toBe(expectedPrivateKey);
			expect(walletController._keystores.mnemonic.getPrivateKey).toHaveBeenCalledWith(currentAccount);
		});
	});

	describe('other keystore methods', () => {
		const keystoreMethodsTestConfig = [
			{
				controllerMethodName: 'signTransaction',
				controllerMethodArguments: ['transaction'],
				keystoreMethodName: 'signTransaction',
				createKeystoreMethodArgs: walletController =>
					[walletController.networkProperties, 'transaction', walletController.currentAccount]
			},
			{
				controllerMethodName: 'signTransactionBundle',
				controllerMethodArguments: ['transactionBundle'],
				keystoreMethodName: 'signTransactionBundle',
				createKeystoreMethodArgs: walletController =>
					[walletController.networkProperties, 'transactionBundle', walletController.currentAccount]
			},
			{
				controllerMethodName: 'cosignTransaction',
				controllerMethodArguments: ['transaction'],
				keystoreMethodName: 'cosignTransaction',
				createKeystoreMethodArgs: walletController =>
					['transaction', walletController.currentAccount]
			},
			{
				controllerMethodName: 'encryptMessage',
				controllerMethodArguments: ['messageText', 'recipientPublicKey'],
				keystoreMethodName: 'encryptMessage',
				createKeystoreMethodArgs: walletController =>
					['messageText', 'recipientPublicKey', walletController.currentAccount]
			},
			{
				controllerMethodName: 'decryptMessage',
				controllerMethodArguments: ['encryptedMessage', 'recipientPublicKey'],
				keystoreMethodName: 'decryptMessage',
				createKeystoreMethodArgs: walletController =>
					['encryptedMessage', 'recipientPublicKey', walletController.currentAccount]
			}
		];

		const runKeystoreMethodTests = (controllerMethodName, controllerMethodArguments, keystoreMethodName, createKeystoreMethodArgs) => {
			describe(`${controllerMethodName}()`, () => {
				it('throws an error when keystore is not accessible', async () => {
					await runAccessKeystoreErrorTest('mnemonic', controllerMethodName, controllerMethodArguments);
				});

				it(`calls keystore.${keystoreMethodName}() with correct arguments`, async () => {
					// Arrange:
					walletController._state = cloneDeep(filledState);
					const expectedResult = 'test result';
					jest.spyOn(walletController._keystores.mnemonic, keystoreMethodName).mockResolvedValue(expectedResult);

					// Act:
					const result = await walletController[controllerMethodName](...controllerMethodArguments);

					// Assert:
					expect(result).toBe(expectedResult);
					expect(walletController._keystores.mnemonic[keystoreMethodName])
						.toHaveBeenCalledWith(...createKeystoreMethodArgs(walletController));
				});
			});
		};

		keystoreMethodsTestConfig.forEach(conf => {
			runKeystoreMethodTests(
				conf.controllerMethodName,
				conf.controllerMethodArguments,
				conf.keystoreMethodName,
				conf.createKeystoreMethodArgs
			);
		});
	});

	describe('clear()', () => {
		it('clears all state properties and persistent storage', async () => {
			// Arrange:
			const initialState = cloneDeep(filledState);
			walletController._state = initialState;
			jest.spyOn(walletController._persistentStorageRepository, 'clear').mockResolvedValue();
			jest.spyOn(walletController._keystores.mnemonic, 'clear').mockResolvedValue();
			jest.spyOn(walletController._keystores.external, 'clear').mockResolvedValue();

			// Act:
			await walletController.clear();
			const actualState = walletController._state;

			// Assert:
			expect(actualState).toStrictEqual(defaultState);
			expect(walletController._persistentStorageRepository.clear).toHaveBeenCalledTimes(1);
			expect(walletController._keystores.mnemonic.clear).toHaveBeenCalledTimes(1);
			expect(walletController._keystores.external.clear).toHaveBeenCalledTimes(1);
		});
	});

	describe('connectToNetwork()', () => {
		it('connects to the network and updates state', async () => {
			// Arrange:
			jest.spyOn(walletController._networkManager, 'runConnectionJob').mockResolvedValue();

			// Act:
			await walletController.connectToNetwork();

			// Assert:
			expect(walletController._networkManager.runConnectionJob).toHaveBeenCalledTimes(1);
		});
	});

	describe('selectNetwork()', () => {
		it('throws an error if network is not supported', async () => {
			// Arrange:
			const unsupportedNetworkIdentifier = 'unsupported_network';
			walletController._state = cloneDeep(filledState);
			jest.spyOn(walletController._networkManager, 'selectNetwork');

			// Act & Assert:
			await expect(walletController.selectNetwork(unsupportedNetworkIdentifier))
				.rejects.toThrow(`Failed to select network. Network "${unsupportedNetworkIdentifier}" is not supported by the wallet.`);
			expect(walletController._networkManager.selectNetwork).not.toHaveBeenCalled();
		});

		it('selects a network and updates state', async () => {
			// Arrange:
			const networkIdentifier = networkIdentifiers[1];
			const nodeUrl = 'http://node.url';
			const expectedNetworkProperties = createDefaultNetworkProperties(networkIdentifier);
			walletController._state = cloneDeep(filledState);
			jest.spyOn(walletController._networkManager, 'selectNetwork').mockResolvedValue();
			jest.spyOn(walletController._persistentStorageRepository, 'setNetworkProperties').mockResolvedValue();
			jest.spyOn(walletController._persistentStorageRepository, 'setNetworkIdentifier').mockResolvedValue();
			jest.spyOn(walletController._persistentStorageRepository, 'setSelectedNode').mockResolvedValue();


			// Act:
			await walletController.selectNetwork(networkIdentifier, nodeUrl);

			// Assert:
			expect(walletController._networkManager.selectNetwork).toHaveBeenCalledWith(networkIdentifier, nodeUrl);
			expect(walletController.networkProperties).toStrictEqual(expectedNetworkProperties);
			expect(walletController.networkIdentifier).toBe(networkIdentifier);
			expect(walletController.selectedNodeUrl).toBe(nodeUrl);
		});
	});

	describe('resetState()', () => {
		it('resets all state properties', () => {
			// Arrange:
			const expectedResetState = cloneDeep(defaultState);
			const initialState = cloneDeep(filledState);

			// Act:
			walletController._state = initialState;
			walletController.resetState();
			const actualState = walletController._state;

			// Assert:
			expect(actualState).toStrictEqual(expectedResetState);
		});
	});
});
