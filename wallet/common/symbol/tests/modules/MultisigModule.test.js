import {
	EMPTY_AGGREGATE_HASH,
	HASH_LOCK_AMOUNT,
	HASH_LOCK_DURATION,
	TransactionBundleType,
	TransactionType
} from '../../src/constants';
import { MultisigModule } from '../../src/modules/MultisigModule';
import { createDeadline, createTransactionFee } from '../../src/utils';
import { accountInfoCosigner, accountInfoNonMultisig } from '../__fixtures__/local/account';
import { networkProperties } from '../__fixtures__/local/network';
import { currentAccount, networkIdentifiers, walletStorageAccounts } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { TransactionBundle } from 'wallet-common-core';

const FIXED_NOW_MS = 1_700_000_000_000;

const cosignatory1 = walletStorageAccounts.testnet[1];
const cosignatory2 = walletStorageAccounts.testnet[2];
const cosignatory3 = walletStorageAccounts.testnet[3];

const multisigAccount = {
	address: 'TAMYTGVH3UEVZRQSD64LGSMPKNTKMASOIDNYROI',
	publicKey: 'ABC123DEF456ABC123DEF456ABC123DEF456ABC123DEF456ABC123DEF456ABC1',
	privateKey: 'PRIVATE123KEY456PRIVATE123KEY456PRIVATE123KEY456PRIVATE123KEY456'
};

const multisigAccountInfo = {
	address: multisigAccount.address,
	publicKey: multisigAccount.publicKey,
	isMultisig: true,
	cosignatories: [cosignatory1.address, cosignatory2.address],
	multisigAddresses: [],
	minApproval: 2,
	minRemoval: 2
};

const createStoredMultisigAccounts = (networkIdentifier, address, accounts) => ({
	mainnet: {},
	testnet: {},
	[networkIdentifier]: { [address]: accounts }
});

describe('MultisigModule', () => {
	let multisigModule;
	let api;
	let walletController;
	let persistentStorageInterface;
	let onStateChange;

	beforeEach(() => {
		api = {
			account: {
				fetchAccountInfo: jest.fn()
			}
		};

		walletController = {
			currentAccount,
			networkProperties,
			networkIdentifier: networkProperties.networkIdentifier
		};

		persistentStorageInterface = {
			getItem: jest.fn().mockResolvedValue(null),
			setItem: jest.fn().mockResolvedValue(undefined),
			removeItem: jest.fn().mockResolvedValue(undefined)
		};

		onStateChange = jest.fn();

		multisigModule = new MultisigModule();
		multisigModule.init({
			walletController,
			api,
			persistentStorageInterface,
			networkIdentifiers,
			onStateChange
		});

		multisigModule._persistentStorageRepository.getMultisigAccounts = jest.fn();
		multisigModule._persistentStorageRepository.setMultisigAccounts = jest.fn();

		jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('has correct static name', () => {
		// Assert:
		expect(MultisigModule.name).toBe('multisig');
	});

	describe('initial state', () => {
		it('multisigAccounts getter returns empty array initially', () => {
			// Assert:
			expect(multisigModule.multisigAccounts).toStrictEqual([]);
		});
	});

	describe('loadCache()', () => {
		it('loads multisig accounts from persistent storage', async () => {
			// Arrange:
			const storedMultisigAccounts = createStoredMultisigAccounts(
				'testnet',
				currentAccount.address,
				[multisigAccountInfo]
			);
			multisigModule._persistentStorageRepository.getMultisigAccounts.mockResolvedValue(storedMultisigAccounts);

			// Act:
			await multisigModule.loadCache();

			// Assert:
			expect(multisigModule._persistentStorageRepository.getMultisigAccounts).toHaveBeenCalled();
			expect(multisigModule.multisigAccounts).toStrictEqual([multisigAccountInfo]);
			expect(onStateChange).toHaveBeenCalled();
		});

		it('initializes with empty state when no cached data exists', async () => {
			// Arrange:
			multisigModule._persistentStorageRepository.getMultisigAccounts.mockResolvedValue(null);

			// Act:
			await multisigModule.loadCache();

			// Assert:
			expect(multisigModule.multisigAccounts).toStrictEqual([]);
			expect(onStateChange).toHaveBeenCalled();
		});
	});

	describe('clear()', () => {
		it('resets state to default', async () => {
			// Arrange:
			const storedMultisigAccounts = createStoredMultisigAccounts(
				'testnet',
				currentAccount.address,
				[multisigAccountInfo]
			);
			multisigModule._persistentStorageRepository.getMultisigAccounts.mockResolvedValue(storedMultisigAccounts);
			await multisigModule.loadCache();
			expect(multisigModule.multisigAccounts).toHaveLength(1);

			// Act:
			multisigModule.clear();

			// Assert:
			expect(multisigModule.multisigAccounts).toStrictEqual([]);
		});
	});

	describe('multisigAccounts getter', () => {
		it('returns empty array when no multisig accounts exist for current account', async () => {
			// Arrange:
			const storedMultisigAccounts = createStoredMultisigAccounts(
				'testnet',
				'DIFFERENT_ADDRESS',
				[multisigAccountInfo]
			);
			multisigModule._persistentStorageRepository.getMultisigAccounts.mockResolvedValue(storedMultisigAccounts);
			await multisigModule.loadCache();

			// Assert:
			expect(multisigModule.multisigAccounts).toStrictEqual([]);
		});
	});

	describe('getMultisigAccountByAddress()', () => {
		beforeEach(async () => {
			const storedMultisigAccounts = createStoredMultisigAccounts(
				'testnet',
				currentAccount.address,
				[multisigAccountInfo]
			);
			multisigModule._persistentStorageRepository.getMultisigAccounts.mockResolvedValue(storedMultisigAccounts);
			await multisigModule.loadCache();
		});

		it('returns multisig account when address matches', () => {
			// Act:
			const result = multisigModule.getMultisigAccountByAddress(multisigAccountInfo.address);

			// Assert:
			expect(result).toStrictEqual(multisigAccountInfo);
		});

		it('returns null when address does not match', () => {
			// Act:
			const result = multisigModule.getMultisigAccountByAddress('NON_EXISTENT_ADDRESS');

			// Assert:
			expect(result).toBeNull();
		});
	});

	describe('fetchData()', () => {
		it('fetches and caches multisig account infos for current account', async () => {
			// Arrange:
			const currentAccountInfoWithMultisig = {
				...accountInfoCosigner,
				multisigAddresses: [multisigAccountInfo.address]
			};
			api.account.fetchAccountInfo
				.mockResolvedValueOnce(currentAccountInfoWithMultisig)
				.mockResolvedValueOnce(multisigAccountInfo);
			multisigModule._persistentStorageRepository.getMultisigAccounts.mockResolvedValue({ testnet: {}, mainnet: {} });

			// Act:
			const result = await multisigModule.fetchData();

			// Assert:
			expect(result).toStrictEqual([multisigAccountInfo]);
			expect(api.account.fetchAccountInfo).toHaveBeenCalledTimes(2);
			expect(api.account.fetchAccountInfo).toHaveBeenNthCalledWith(1, networkProperties, currentAccount.address);
			expect(api.account.fetchAccountInfo).toHaveBeenNthCalledWith(2, networkProperties, multisigAccountInfo.address);
			expect(multisigModule._persistentStorageRepository.setMultisigAccounts).toHaveBeenCalledWith({
				testnet: { [currentAccount.address]: [multisigAccountInfo] },
				mainnet: {}
			});
			expect(multisigModule.multisigAccounts).toStrictEqual([multisigAccountInfo]);
			expect(onStateChange).toHaveBeenCalled();
		});

		it('returns empty array and clears cache when account has no multisig addresses', async () => {
			// Arrange:
			api.account.fetchAccountInfo.mockResolvedValue(accountInfoNonMultisig);
			multisigModule._persistentStorageRepository.getMultisigAccounts.mockResolvedValue({ testnet: {}, mainnet: {} });

			// Act:
			const result = await multisigModule.fetchData();

			// Assert:
			expect(result).toStrictEqual([]);
			expect(api.account.fetchAccountInfo).toHaveBeenCalledTimes(1);
			expect(multisigModule._persistentStorageRepository.setMultisigAccounts).toHaveBeenCalledWith({
				testnet: { [currentAccount.address]: [] },
				mainnet: {}
			});
		});

	});

	describe('fetchAccountInfo()', () => {
		it('fetches account info for given address', async () => {
			// Arrange:
			const address = 'SOME_ADDRESS';
			const expectedAccountInfo = { address, publicKey: 'SOME_PUBLIC_KEY' };
			api.account.fetchAccountInfo.mockResolvedValue(expectedAccountInfo);

			// Act:
			const result = await multisigModule.fetchAccountInfo(address);

			// Assert:
			expect(result).toStrictEqual(expectedAccountInfo);
			expect(api.account.fetchAccountInfo).toHaveBeenCalledTimes(1);
			expect(api.account.fetchAccountInfo).toHaveBeenCalledWith(networkProperties, address);
		});
	});

	describe('createTransaction()', () => {
		const createExpectedTransactionBundle = config => {
			const {
				multisigAccount: msigAccount,
				addressAdditions,
				addressDeletions,
				minApprovalDelta,
				minRemovalDelta,
				cosignaturePrivateKeys
			} = config;

			const multisigModificationTransaction = {
				type: TransactionType.MULTISIG_ACCOUNT_MODIFICATION,
				signerPublicKey: msigAccount.publicKey,
				signerAddress: msigAccount.address,
				minApprovalDelta,
				minRemovalDelta,
				addressAdditions,
				addressDeletions
			};

			const defaultFee = createTransactionFee(networkProperties, '0');

			const hashLockTransaction = {
				type: TransactionType.HASH_LOCK,
				signerPublicKey: currentAccount.publicKey,
				mosaic: {
					id: networkProperties.networkCurrency.mosaicId,
					amount: HASH_LOCK_AMOUNT,
					divisibility: networkProperties.networkCurrency.divisibility
				},
				lockedAmount: HASH_LOCK_AMOUNT,
				duration: HASH_LOCK_DURATION,
				fee: defaultFee,
				deadline: createDeadline(2, networkProperties.epochAdjustment),
				aggregateHash: EMPTY_AGGREGATE_HASH
			};

			const aggregateBondedTransaction = {
				type: TransactionType.AGGREGATE_BONDED,
				innerTransactions: [multisigModificationTransaction],
				signerPublicKey: currentAccount.publicKey,
				signerAddress: currentAccount.address,
				fee: defaultFee,
				deadline: createDeadline(48, networkProperties.epochAdjustment)
			};

			return new TransactionBundle(
				[hashLockTransaction, aggregateBondedTransaction],
				{
					type: TransactionBundleType.MULTISIG_ACCOUNT_MODIFICATION,
					cosignaturePrivateKeys
				}
			);
		};

		it('creates transaction for converting account to multisig with private key', () => {
			// Arrange:
			const options = {
				multisigAccount,
				addressAdditions: [cosignatory1.address, cosignatory2.address],
				addressDeletions: [],
				minApprovalDelta: 2,
				minRemovalDelta: 2
			};
			const expectedBundle = createExpectedTransactionBundle({
				...options,
				cosignaturePrivateKeys: [multisigAccount.privateKey]
			});

			// Act:
			const result = multisigModule.createTransaction(options);

			// Assert:
			expect(result.toJSON()).toStrictEqual(expectedBundle.toJSON());
		});

		it('creates transaction for modifying existing multisig without private key', () => {
			// Arrange:
			const publicMultisigAccount = {
				address: multisigAccount.address,
				publicKey: multisigAccount.publicKey
			};
			const options = {
				multisigAccount: publicMultisigAccount,
				addressAdditions: [cosignatory3.address],
				addressDeletions: [cosignatory1.address],
				minApprovalDelta: 0,
				minRemovalDelta: 1
			};
			const expectedBundle = createExpectedTransactionBundle({
				...options,
				cosignaturePrivateKeys: []
			});

			// Act:
			const result = multisigModule.createTransaction(options);

			// Assert:
			expect(result.toJSON()).toStrictEqual(expectedBundle.toJSON());
		});

		it('creates transaction with only address deletions', () => {
			// Arrange:
			const publicMultisigAccount = {
				address: multisigAccount.address,
				publicKey: multisigAccount.publicKey
			};
			const options = {
				multisigAccount: publicMultisigAccount,
				addressAdditions: [],
				addressDeletions: [cosignatory1.address],
				minApprovalDelta: -1,
				minRemovalDelta: -1
			};
			const expectedBundle = createExpectedTransactionBundle({
				...options,
				cosignaturePrivateKeys: []
			});

			// Act:
			const result = multisigModule.createTransaction(options);

			// Assert:
			expect(result.toJSON()).toStrictEqual(expectedBundle.toJSON());
		});

		it('creates transaction with only min approval/removal changes', () => {
			// Arrange:
			const publicMultisigAccount = {
				address: multisigAccount.address,
				publicKey: multisigAccount.publicKey
			};
			const options = {
				multisigAccount: publicMultisigAccount,
				addressAdditions: [],
				addressDeletions: [],
				minApprovalDelta: 1,
				minRemovalDelta: -1
			};
			const expectedBundle = createExpectedTransactionBundle({
				...options,
				cosignaturePrivateKeys: []
			});

			// Act:
			const result = multisigModule.createTransaction(options);

			// Assert:
			expect(result.toJSON()).toStrictEqual(expectedBundle.toJSON());
		});
	});

	describe('calculateDeltas()', () => {
		const testCases = [
			{
				description: 'calculates additions when new cosignatories are added',
				config: {
					multisigAccountInfo: {
						cosignatories: [cosignatory1.address],
						minApproval: 1,
						minRemoval: 1
					},
					updatedValues: {
						cosignatories: [cosignatory1.address, cosignatory2.address, cosignatory3.address],
						minApproval: 2,
						minRemoval: 2
					}
				},
				expected: {
					addressAdditions: [cosignatory2.address, cosignatory3.address],
					addressDeletions: [],
					minApprovalDelta: 1,
					minRemovalDelta: 1
				}
			},
			{
				description: 'calculates deletions when cosignatories are removed',
				config: {
					multisigAccountInfo: {
						cosignatories: [cosignatory1.address, cosignatory2.address, cosignatory3.address],
						minApproval: 3,
						minRemoval: 3
					},
					updatedValues: {
						cosignatories: [cosignatory1.address],
						minApproval: 1,
						minRemoval: 1
					}
				},
				expected: {
					addressAdditions: [],
					addressDeletions: [cosignatory2.address, cosignatory3.address],
					minApprovalDelta: -2,
					minRemovalDelta: -2
				}
			},
			{
				description: 'returns zero deltas when no changes are made',
				config: {
					multisigAccountInfo: {
						cosignatories: [cosignatory1.address, cosignatory2.address],
						minApproval: 2,
						minRemoval: 2
					},
					updatedValues: {
						cosignatories: [cosignatory1.address, cosignatory2.address],
						minApproval: 2,
						minRemoval: 2
					}
				},
				expected: {
					addressAdditions: [],
					addressDeletions: [],
					minApprovalDelta: 0,
					minRemovalDelta: 0
				}
			},
			{
				description: 'calculates negative deltas when min values are decreased',
				config: {
					multisigAccountInfo: {
						cosignatories: [cosignatory1.address, cosignatory2.address],
						minApproval: 2,
						minRemoval: 2
					},
					updatedValues: {
						cosignatories: [cosignatory1.address, cosignatory2.address],
						minApproval: 1,
						minRemoval: 1
					}
				},
				expected: {
					addressAdditions: [],
					addressDeletions: [],
					minApprovalDelta: -1,
					minRemovalDelta: -1
				}
			}
		];

		const runCalculateDeltasTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const options = {
					multisigAccountInfo: config.multisigAccountInfo,
					updatedValues: config.updatedValues
				};

				// Act:
				const result = multisigModule.calculateDeltas(options);

				// Assert:
				expect(result).toStrictEqual(expected);
			});

		};

		testCases.forEach(({ description, config, expected }) => {
			runCalculateDeltasTest(description, config, expected);
		});
	});
});
