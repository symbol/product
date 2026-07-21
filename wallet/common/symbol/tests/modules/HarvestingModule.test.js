import {
	EMPTY_AGGREGATE_HASH,
	HASH_LOCK_AMOUNT,
	HASH_LOCK_DURATION,
	HarvestingStatus,
	LinkAction,
	LinkActionMessage,
	MULTISIG_TRANSACTION_DEADLINE_HOURS,
	MessageType,
	SINGLE_TRANSACTION_DEADLINE_HOURS,
	TransactionBundleType,
	TransactionType
} from '../../src/constants';
import { addressFromPublicKey, createDeadline, createTransactionFee } from '../../src/utils';
import { accountInfoMultisig, accountInfoNonMultisig } from '../__fixtures__/local/account';
import { harvestedBlocks } from '../__fixtures__/local/harvesting';
import { networkProperties } from '../__fixtures__/local/network';
import { currentAccount, networkIdentifiers, walletStorageAccounts } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { ControllerError, TransactionBundle } from 'wallet-common-core';

jest.unstable_mockModule('lodash', () => ({
	shuffle: jest.fn(array => [...array].reverse())
}));

// Import after mocks
const { HarvestingModule } = await import('../../src/modules/HarvestingModule');

// Constants

const FIXED_NOW_MS = 1_700_000_000_000;
const NODE_PUBLIC_KEY = '26BB5F23FAE6E93798D170E971250963F025048928478825FC0F51A394C30987';
const UNCACHED_ADDRESS = walletStorageAccounts.testnet[2].address;

const nodeList = [
	'https://node-1.example.com:3001',
	'https://node-2.example.com:3001',
	'https://node-3.example.com:3001'
];

// The order the module links and unlinks the supplemental keys in
const keyLinkOrder = [
	{ type: TransactionType.VRF_KEY_LINK, field: 'vrfPublicKey' },
	{ type: TransactionType.ACCOUNT_KEY_LINK, field: 'linkedPublicKey' },
	{ type: TransactionType.NODE_KEY_LINK, field: 'nodePublicKey' }
];

// Account Fixtures

// A multisig account the current account harvests for. Its address differs from the current account's,
// which is what makes the module treat the request as multisig.
const multisigAccountInfo = {
	...accountInfoMultisig,
	address: walletStorageAccounts.testnet[1].address,
	publicKey: walletStorageAccounts.testnet[1].publicKey
};

// AccountInfo the node returns for an address it does not know: the account has never sent a transaction,
// so the network holds no public key for it.
const inactiveMultisigAccountInfo = {
	...multisigAccountInfo,
	publicKey: null,
	linkedKeys: {
		linkedPublicKey: null,
		nodePublicKey: null,
		vrfPublicKey: null
	}
};

const accountInfoWithoutLinkedKeys = {
	...accountInfoNonMultisig,
	linkedKeys: {}
};

// The accounts a harvesting transaction can be created for. An absent address means the current account.
const harvester = {
	currentAccount: { accountInfo: accountInfoNonMultisig },
	currentAccountWithoutLinkedKeys: { accountInfo: accountInfoWithoutLinkedKeys },
	multisigAccount: { accountInfo: multisigAccountInfo, address: multisigAccountInfo.address },
	inactiveMultisigAccount: { accountInfo: inactiveMultisigAccountInfo, address: inactiveMultisigAccountInfo.address }
};

// Harvesting Fixtures

const harvestingStatus = {
	status: HarvestingStatus.ACTIVE,
	nodeUrl: 'https://node-1.example.com:3001'
};

const multisigHarvestingStatus = {
	status: HarvestingStatus.INACTIVE
};

const harvestingSummary = {
	latestAmount: '86.708944',
	latestHeight: 2637258,
	latestDate: '2025-08-19T12:31:52.899Z',
	amountPer30Days: '867.08944',
	blocksHarvestedPer30Days: 10
};

const multisigHarvestingSummary = {
	latestAmount: '12.5',
	latestHeight: 2600000,
	latestDate: '2025-08-01T09:15:00.000Z',
	amountPer30Days: '40.5',
	blocksHarvestedPer30Days: 5
};

// Factory Functions

const createStoredHarvestingStatuses = (networkIdentifier, statusesByAddress) => ({
	mainnet: {},
	testnet: {},
	[networkIdentifier]: statusesByAddress
});

const createStoredHarvestingSummaries = (networkIdentifier, summariesByAddress) => ({
	mainnet: {},
	testnet: {},
	[networkIdentifier]: summariesByAddress
});

/**
 * Builds the key link transactions in the order the module produces them,
 * skipping the keys the account does not hold.
 */
const buildKeyLinkTransactions = (linkedKeys, linkAction, signerPublicKey) => keyLinkOrder
	.filter(({ field }) => !!linkedKeys[field])
	.map(({ type, field }) => ({
		type,
		linkAction: LinkActionMessage[linkAction],
		linkedPublicKey: linkedKeys[field],
		signerPublicKey
	}));

/** Builds the transfer that asks the node to harvest on the account's behalf. */
const buildHarvestingRequestTransfer = (signerPublicKey, payload) => ({
	type: TransactionType.TRANSFER,
	mosaics: [],
	message: {
		type: MessageType.DelegatedHarvesting,
		payload,
		text: ''
	},
	signerPublicKey,
	recipientAddress: addressFromPublicKey(NODE_PUBLIC_KEY, networkProperties.networkIdentifier)
});

/** Builds the bundle the module produces for the current account: a single aggregate complete transaction. */
const buildSingleAccountBundle = innerTransactions => new TransactionBundle(
	[
		{
			type: TransactionType.AGGREGATE_COMPLETE,
			innerTransactions,
			signerPublicKey: currentAccount.publicKey,
			fee: createTransactionFee(networkProperties, '0'),
			deadline: createDeadline(SINGLE_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment)
		}
	],
	{ type: TransactionBundleType.DELEGATED_HARVESTING }
);

/** Builds the bundle the module produces for a multisig account: a hash lock funding an aggregate bonded transaction. */
const buildMultisigBundle = innerTransactions => {
	const transactionFee = createTransactionFee(networkProperties, '0');
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
		fee: transactionFee,
		deadline: createDeadline(SINGLE_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment),
		aggregateHash: EMPTY_AGGREGATE_HASH
	};
	const aggregateBondedTransaction = {
		type: TransactionType.AGGREGATE_BONDED,
		innerTransactions,
		signerPublicKey: currentAccount.publicKey,
		signerAddress: currentAccount.address,
		fee: transactionFee,
		deadline: createDeadline(MULTISIG_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment)
	};

	return new TransactionBundle(
		[hashLockTransaction, aggregateBondedTransaction],
		{ type: TransactionBundleType.MULTISIG_DELEGATED_HARVESTING, cosignaturePrivateKeys: [] }
	);
};

describe('HarvestingModule', () => {
	let harvestingModule;
	let api;
	let onStateChange;
	let persistentStorageInterface;
	let walletController;

	beforeEach(() => {
		jest.clearAllMocks();

		api = {
			harvesting: {
				fetchStatus: jest.fn(),
				fetchHarvestedBlocks: jest.fn(),
				fetchNodeList: jest.fn(),
				fetchSummary: jest.fn()
			},
			account: {
				fetchAccountInfo: jest.fn()
			}
		};

		walletController = {
			currentAccount,
			currentAccountInfo: accountInfoNonMultisig,
			networkProperties,
			networkIdentifier: networkProperties.networkIdentifier,
			getCurrentAccountPrivateKey: jest.fn()
		};

		persistentStorageInterface = {
			getItem: jest.fn().mockResolvedValue(null),
			setItem: jest.fn().mockResolvedValue(undefined),
			removeItem: jest.fn().mockResolvedValue(undefined)
		};

		onStateChange = jest.fn();

		harvestingModule = new HarvestingModule();
		harvestingModule.init({
			walletController,
			api,
			persistentStorageInterface,
			networkIdentifiers,
			onStateChange
		});

		// Nothing is cached unless a test says otherwise
		harvestingModule._persistentStorageRepository.getHarvestingStatuses = jest.fn().mockResolvedValue(null);
		harvestingModule._persistentStorageRepository.setHarvestingStatuses = jest.fn();
		harvestingModule._persistentStorageRepository.getHarvestingSummaries = jest.fn().mockResolvedValue(null);
		harvestingModule._persistentStorageRepository.setHarvestingSummaries = jest.fn();

		// The transaction deadlines are derived from the current time, which is frozen to keep them predictable.
		jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('has correct static name', () => {
		// Assert:
		expect(HarvestingModule.name).toBe('harvesting');
	});

	describe('initial state', () => {
		it('status getter returns null initially', () => {
			// Assert:
			expect(harvestingModule.status).toBeNull();
		});

		it('summary getter returns null initially', () => {
			// Assert:
			expect(harvestingModule.summary).toBeNull();
		});
	});

	describe('loadCache()', () => {
		it('loads harvesting status and summary from persistent storage', async () => {
			// Arrange:
			const storedStatuses = createStoredHarvestingStatuses('testnet', { [currentAccount.address]: harvestingStatus });
			const storedSummaries = createStoredHarvestingSummaries('testnet', { [currentAccount.address]: harvestingSummary });
			harvestingModule._persistentStorageRepository.getHarvestingStatuses.mockResolvedValue(storedStatuses);
			harvestingModule._persistentStorageRepository.getHarvestingSummaries.mockResolvedValue(storedSummaries);

			// Act:
			await harvestingModule.loadCache();

			// Assert:
			expect(harvestingModule._persistentStorageRepository.getHarvestingStatuses).toHaveBeenCalled();
			expect(harvestingModule._persistentStorageRepository.getHarvestingSummaries).toHaveBeenCalled();
			expect(harvestingModule.status).toStrictEqual(harvestingStatus);
			expect(harvestingModule.summary).toStrictEqual(harvestingSummary);
			expect(onStateChange).toHaveBeenCalled();
		});

		it('initializes empty state when no cached harvesting data exists', async () => {
			// Act:
			await harvestingModule.loadCache();

			// Assert:
			expect(harvestingModule.status).toBeNull();
			expect(harvestingModule.summary).toBeNull();
			expect(onStateChange).toHaveBeenCalled();
		});
	});

	describe('clear()', () => {
		it('resets cached state to default values', async () => {
			// Arrange:
			const storedStatuses = createStoredHarvestingStatuses('testnet', { [currentAccount.address]: harvestingStatus });
			const storedSummaries = createStoredHarvestingSummaries('testnet', { [currentAccount.address]: harvestingSummary });
			harvestingModule._persistentStorageRepository.getHarvestingStatuses.mockResolvedValue(storedStatuses);
			harvestingModule._persistentStorageRepository.getHarvestingSummaries.mockResolvedValue(storedSummaries);
			await harvestingModule.loadCache();

			// Act:
			harvestingModule.clear();

			// Assert:
			expect(harvestingModule.status).toBeNull();
			expect(harvestingModule.summary).toBeNull();
		});
	});

	describe('getStatus()', () => {
		const runGetStatusTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const storedStatuses = createStoredHarvestingStatuses('testnet', {
					[currentAccount.address]: harvestingStatus,
					[multisigAccountInfo.address]: multisigHarvestingStatus
				});
				harvestingModule._persistentStorageRepository.getHarvestingStatuses.mockResolvedValue(storedStatuses);
				await harvestingModule.loadCache();

				// Act:
				const result = harvestingModule.getStatus(config.address);

				// Assert:
				expect(result).toStrictEqual(expected.status);
			});
		};

		const getStatusTests = [
			{
				description: 'returns the cached status of the current account',
				config: { address: currentAccount.address },
				expected: { status: harvestingStatus }
			},
			{
				description: 'returns the cached status of a multisig account',
				config: { address: multisigAccountInfo.address },
				expected: { status: multisigHarvestingStatus }
			},
			{
				description: 'returns null when the account has no cached status',
				config: { address: UNCACHED_ADDRESS },
				expected: { status: null }
			},
			{
				description: 'returns null when no address is given',
				config: {},
				expected: { status: null }
			}
		];

		getStatusTests.forEach(test => {
			runGetStatusTest(test.description, test.config, test.expected);
		});
	});

	describe('getSummary()', () => {
		const runGetSummaryTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const storedSummaries = createStoredHarvestingSummaries('testnet', {
					[currentAccount.address]: harvestingSummary,
					[multisigAccountInfo.address]: multisigHarvestingSummary
				});
				harvestingModule._persistentStorageRepository.getHarvestingSummaries.mockResolvedValue(storedSummaries);
				await harvestingModule.loadCache();

				// Act:
				const result = harvestingModule.getSummary(config.address);

				// Assert:
				expect(result).toStrictEqual(expected.summary);
			});
		};

		const getSummaryTests = [
			{
				description: 'returns the cached summary of the current account',
				config: { address: currentAccount.address },
				expected: { summary: harvestingSummary }
			},
			{
				description: 'returns the cached summary of a multisig account',
				config: { address: multisigAccountInfo.address },
				expected: { summary: multisigHarvestingSummary }
			},
			{
				description: 'returns null when the account has no cached summary',
				config: { address: UNCACHED_ADDRESS },
				expected: { summary: null }
			},
			{
				description: 'returns null when no address is given',
				config: {},
				expected: { summary: null }
			}
		];

		getSummaryTests.forEach(test => {
			runGetSummaryTest(test.description, test.config, test.expected);
		});
	});

	describe('fetchStatus()', () => {
		const runFetchStatusTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				api.harvesting.fetchStatus.mockResolvedValue(harvestingStatus);

				// Act:
				const result = await harvestingModule.fetchStatus(config.account);

				// Assert:
				expect(result).toStrictEqual(harvestingStatus);
				expect(api.harvesting.fetchStatus).toHaveBeenCalledTimes(1);
				expect(api.harvesting.fetchStatus).toHaveBeenCalledWith(networkProperties, expected.account);
				expect(harvestingModule._persistentStorageRepository.setHarvestingStatuses).toHaveBeenCalledWith({
					mainnet: {},
					testnet: { [expected.account.address]: harvestingStatus }
				});
				expect(harvestingModule.getStatus(expected.account.address)).toStrictEqual(harvestingStatus);
				expect(onStateChange).toHaveBeenCalled();
			});
		};

		const fetchStatusTests = [
			{
				description: 'fetches and caches the status of the current account by default',
				config: {},
				expected: { account: currentAccount }
			},
			{
				description: 'fetches and caches the status of a given multisig account',
				config: { account: multisigAccountInfo },
				expected: { account: multisigAccountInfo }
			}
		];

		fetchStatusTests.forEach(test => {
			runFetchStatusTest(test.description, test.config, test.expected);
		});

		it('caches the status per account, keeping the status of the other accounts', async () => {
			// Arrange:
			const storedStatuses = createStoredHarvestingStatuses('testnet', { [currentAccount.address]: harvestingStatus });
			harvestingModule._persistentStorageRepository.getHarvestingStatuses.mockResolvedValue(storedStatuses);
			await harvestingModule.loadCache();
			api.harvesting.fetchStatus.mockResolvedValue(multisigHarvestingStatus);

			// Act:
			await harvestingModule.fetchStatus(multisigAccountInfo);

			// Assert:
			expect(harvestingModule.getStatus(currentAccount.address)).toStrictEqual(harvestingStatus);
			expect(harvestingModule.getStatus(multisigAccountInfo.address)).toStrictEqual(multisigHarvestingStatus);
		});
	});

	describe('fetchAccountHarvestedBlocks()', () => {
		it('fetches harvested blocks with pagination criteria', async () => {
			// Arrange:
			const searchCriteria = { pageNumber: 2, pageSize: 5 };
			api.harvesting.fetchHarvestedBlocks.mockResolvedValue(harvestedBlocks);

			// Act:
			const result = await harvestingModule.fetchAccountHarvestedBlocks(searchCriteria);

			// Assert:
			expect(result).toStrictEqual(harvestedBlocks);
			expect(api.harvesting.fetchHarvestedBlocks).toHaveBeenCalledTimes(1);
			expect(api.harvesting.fetchHarvestedBlocks).toHaveBeenCalledWith(
				networkProperties,
				currentAccount.address,
				searchCriteria
			);
		});
	});

	describe('fetchNodeList()', () => {
		it('fetches and shuffles the node list', async () => {
			// Arrange: shuffle is mocked to reverse, so the shuffled order is predictable.
			api.harvesting.fetchNodeList.mockResolvedValue(nodeList);
			const expectedNodeList = [...nodeList].reverse();

			// Act:
			const result = await harvestingModule.fetchNodeList();

			// Assert:
			expect(api.harvesting.fetchNodeList).toHaveBeenCalledTimes(1);
			expect(api.harvesting.fetchNodeList).toHaveBeenCalledWith(networkProperties.networkIdentifier);
			expect(result).toStrictEqual(expectedNodeList);
		});
	});

	describe('fetchSummary()', () => {
		const runFetchSummaryTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				api.harvesting.fetchSummary.mockResolvedValue(harvestingSummary);

				// Act:
				const result = await harvestingModule.fetchSummary(config.address);

				// Assert:
				expect(result).toStrictEqual(harvestingSummary);
				expect(api.harvesting.fetchSummary).toHaveBeenCalledTimes(1);
				expect(api.harvesting.fetchSummary).toHaveBeenCalledWith(networkProperties, expected.address);
				expect(harvestingModule._persistentStorageRepository.setHarvestingSummaries).toHaveBeenCalledWith({
					mainnet: {},
					testnet: { [expected.address]: harvestingSummary }
				});
				expect(harvestingModule.getSummary(expected.address)).toStrictEqual(harvestingSummary);
				expect(onStateChange).toHaveBeenCalled();
			});
		};

		const fetchSummaryTests = [
			{
				description: 'fetches and caches the summary of the current account by default',
				config: {},
				expected: { address: currentAccount.address }
			},
			{
				description: 'fetches and caches the summary of a given multisig account',
				config: { address: multisigAccountInfo.address },
				expected: { address: multisigAccountInfo.address }
			}
		];

		fetchSummaryTests.forEach(test => {
			runFetchSummaryTest(test.description, test.config, test.expected);
		});
	});

	describe('createStopHarvestingTransaction()', () => {
		const runCreateStopHarvestingTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				api.account.fetchAccountInfo.mockResolvedValue(config.harvester.accountInfo);

				// Act:
				const result = await harvestingModule.createStopHarvestingTransaction({
					harvesterAddress: config.harvester.address
				});

				// Assert:
				const unlinkTransactions = buildKeyLinkTransactions(
					config.harvester.accountInfo.linkedKeys,
					LinkAction.Unlink,
					expected.signerPublicKey
				);
				const expectedBundle = expected.buildBundle(unlinkTransactions);
				expect(result.toJSON()).toStrictEqual(expectedBundle.toJSON());
			});
		};

		const createStopHarvestingTransactionTests = [
			{
				description: 'creates an aggregate complete bundle unlinking the keys of the current account',
				config: { harvester: harvester.currentAccount },
				expected: { signerPublicKey: currentAccount.publicKey, buildBundle: buildSingleAccountBundle }
			},
			{
				description: 'creates an aggregate bonded bundle unlinking the keys of a multisig account',
				config: { harvester: harvester.multisigAccount },
				expected: { signerPublicKey: multisigAccountInfo.publicKey, buildBundle: buildMultisigBundle }
			}
		];

		createStopHarvestingTransactionTests.forEach(test => {
			runCreateStopHarvestingTransactionTest(test.description, test.config, test.expected);
		});

		const runCreateStopHarvestingTransactionErrorTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				api.account.fetchAccountInfo.mockResolvedValue(config.harvester.accountInfo);

				// Act:
				const promise = harvestingModule.createStopHarvestingTransaction({
					harvesterAddress: config.harvester.address
				});

				// Assert:
				await expect(promise).rejects.toStrictEqual(expected.error);
			});
		};

		const createStopHarvestingTransactionErrorTests = [
			{
				description: 'throws when the harvester holds no keys to unlink',
				config: { harvester: harvester.currentAccountWithoutLinkedKeys },
				expected: {
					error: new ControllerError(
						'error_harvesting_no_keys_to_unlink',
						'Failed to create stop harvesting transaction. No keys to unlink.'
					)
				}
			},
			{
				description: 'throws when the multisig harvester has never been active on the network',
				config: { harvester: harvester.inactiveMultisigAccount },
				expected: {
					error: new ControllerError(
						'error_harvesting_account_no_activity',
						'Failed to create harvesting transaction. Public key for account '
							+ `"${inactiveMultisigAccountInfo.address}" does not exist on the network.`
					)
				}
			}
		];

		createStopHarvestingTransactionErrorTests.forEach(test => {
			runCreateStopHarvestingTransactionErrorTest(test.description, test.config, test.expected);
		});

		it('unlinks the keys the harvester holds on chain, and not the cached ones', async () => {
			// Arrange: the cached account info holds the keys of a harvesting session that has already been rotated.
			const onChainLinkedKeys = {
				linkedPublicKey: '11111111111111111111111111111111111111111111111111111111111111AA',
				nodePublicKey: '11111111111111111111111111111111111111111111111111111111111111BB',
				vrfPublicKey: '11111111111111111111111111111111111111111111111111111111111111CC'
			};
			walletController.currentAccountInfo = accountInfoNonMultisig;
			api.account.fetchAccountInfo.mockResolvedValue({
				...accountInfoNonMultisig,
				linkedKeys: onChainLinkedKeys
			});

			// Act:
			const result = await harvestingModule.createStopHarvestingTransaction({});

			// Assert:
			const [aggregate] = result.transactions;
			const unlinkedPublicKeys = aggregate.innerTransactions.map(transaction => transaction.linkedPublicKey);
			expect(api.account.fetchAccountInfo).toHaveBeenCalledWith(networkProperties, currentAccount.address);
			expect(unlinkedPublicKeys).toStrictEqual([
				onChainLinkedKeys.vrfPublicKey,
				onChainLinkedKeys.linkedPublicKey,
				onChainLinkedKeys.nodePublicKey
			]);
		});
	});

	describe('createStartHarvestingTransaction()', () => {
		const runCreateStartHarvestingTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				api.account.fetchAccountInfo.mockResolvedValue(config.harvester.accountInfo);

				// Act:
				const result = await harvestingModule.createStartHarvestingTransaction({
					nodePublicKey: NODE_PUBLIC_KEY,
					harvesterAddress: config.harvester.address
				});

				// Assert: the VRF and remote keys are generated per call, so they are read back from the result.
				const { innerTransactions } = result.transactions.at(-1);
				const [generatedVrfPublicKey, generatedRemotePublicKey] = innerTransactions
					.filter(transaction => transaction.linkAction === LinkActionMessage[LinkAction.Link])
					.map(transaction => transaction.linkedPublicKey);
				const requestTransfer = innerTransactions.find(transaction => transaction.type === TransactionType.TRANSFER);
				const expectedBundle = expected.buildBundle([
					...buildKeyLinkTransactions(
						config.harvester.accountInfo.linkedKeys,
						LinkAction.Unlink,
						expected.signerPublicKey
					),
					...buildKeyLinkTransactions(
						{
							vrfPublicKey: generatedVrfPublicKey,
							linkedPublicKey: generatedRemotePublicKey,
							nodePublicKey: NODE_PUBLIC_KEY
						},
						LinkAction.Link,
						expected.signerPublicKey
					),
					buildHarvestingRequestTransfer(expected.signerPublicKey, requestTransfer.message.payload)
				]);

				expect(result.toJSON()).toStrictEqual(expectedBundle.toJSON());
			});
		};

		const createStartHarvestingTransactionTests = [
			{
				description: 'unlinks the current keys, links the new ones and requests the node to harvest',
				config: { harvester: harvester.currentAccount },
				expected: { signerPublicKey: currentAccount.publicKey, buildBundle: buildSingleAccountBundle }
			},
			{
				description: 'skips the unlink transactions when the current account holds no keys',
				config: { harvester: harvester.currentAccountWithoutLinkedKeys },
				expected: { signerPublicKey: currentAccount.publicKey, buildBundle: buildSingleAccountBundle }
			},
			{
				description: 'creates an aggregate bonded bundle signed by a multisig account',
				config: { harvester: harvester.multisigAccount },
				expected: { signerPublicKey: multisigAccountInfo.publicKey, buildBundle: buildMultisigBundle }
			}
		];

		createStartHarvestingTransactionTests.forEach(test => {
			runCreateStartHarvestingTransactionTest(test.description, test.config, test.expected);
		});

		it('throws when the multisig harvester has never been active on the network', async () => {
			// Arrange:
			const expectedError = new ControllerError(
				'error_harvesting_account_no_activity',
				'Failed to create harvesting transaction. Public key for account '
					+ `"${inactiveMultisigAccountInfo.address}" does not exist on the network.`
			);
			api.account.fetchAccountInfo.mockResolvedValue(inactiveMultisigAccountInfo);

			// Act:
			const promise = harvestingModule.createStartHarvestingTransaction({
				nodePublicKey: NODE_PUBLIC_KEY,
				harvesterAddress: inactiveMultisigAccountInfo.address
			});

			// Assert:
			await expect(promise).rejects.toStrictEqual(expectedError);
		});

		it('fetches the harvester account info from the network on every call', async () => {
			// Arrange:
			api.account.fetchAccountInfo.mockResolvedValue(multisigAccountInfo);

			// Act:
			await harvestingModule.createStartHarvestingTransaction({
				nodePublicKey: NODE_PUBLIC_KEY,
				harvesterAddress: multisigAccountInfo.address
			});

			// Assert:
			expect(api.account.fetchAccountInfo).toHaveBeenCalledTimes(1);
			expect(api.account.fetchAccountInfo).toHaveBeenCalledWith(networkProperties, multisigAccountInfo.address);
		});
	});
});
