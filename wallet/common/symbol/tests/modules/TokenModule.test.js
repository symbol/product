import {
	EMPTY_AGGREGATE_HASH,
	HASH_LOCK_AMOUNT,
	HASH_LOCK_DURATION,
	MULTISIG_TRANSACTION_DEADLINE_HOURS,
	MosaicSupplyChangeAction,
	MosaicSupplyChangeActionMessage,
	SINGLE_TRANSACTION_DEADLINE_HOURS,
	TransactionBundleType,
	TransactionType
} from '../../src/constants';
import { TokenModule } from '../../src/modules/TokenModule';
import {
	addressFromPublicKey,
	calculateTransactionSize,
	createDeadline,
	createTransactionFee,
	createTransactionFeeTiers,
	mosaicIdFromNonce
} from '../../src/utils';
import { mosaicInfos, mosaicOwners } from '../__fixtures__/local/mosaic';
import { networkProperties } from '../__fixtures__/local/network';
import { currentAccount, walletStorageAccounts } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { TransactionBundle, relativeToAbsoluteAmount } from 'wallet-common-core';

const multisigAccount = walletStorageAccounts.testnet[1];
const holderAccount = walletStorageAccounts.testnet[2];
const token = mosaicInfos['78C3CDF0896248DB'];
const fixedNowMilliseconds = 1_700_000_000_000;

// A token action is performed on behalf of a multisig account when the sender public key differs from the current account.
const sender = {
	currentAccount: { publicKey: currentAccount.publicKey, isMultisig: false },
	multisigAccount: { publicKey: multisigAccount.publicKey, isMultisig: true }
};

const defaultFee = createTransactionFee(networkProperties, '0');
const singleDeadline = () => createDeadline(SINGLE_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment);
const multisigDeadline = () => createDeadline(MULTISIG_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment);
const resolveSenderAddress = publicKey => addressFromPublicKey(publicKey, networkProperties.networkIdentifier);

const withSender = (options, senderContext) =>
	(senderContext.isMultisig ? { ...options, senderPublicKey: senderContext.publicKey } : options);

const expectBundlesEqual = (result, expectedResult) => expect(result.toJSON()).toStrictEqual(expectedResult.toJSON());

const buildMultisigBundle = (innerTransactions, bundleType) => {
	const hashLock = {
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
		deadline: singleDeadline(),
		aggregateHash: EMPTY_AGGREGATE_HASH
	};
	const aggregateBonded = {
		type: TransactionType.AGGREGATE_BONDED,
		innerTransactions,
		signerPublicKey: currentAccount.publicKey,
		signerAddress: currentAccount.address,
		fee: defaultFee,
		deadline: multisigDeadline()
	};

	return new TransactionBundle([hashLock, aggregateBonded], { type: bundleType });
};

const buildSingleAccountBundle = (transaction, bundleType) =>
	new TransactionBundle([{ ...transaction, deadline: singleDeadline(), fee: defaultFee }], { type: bundleType });

const buildAggregateCompleteBundle = (innerTransactions, signerPublicKey, bundleType) =>
	new TransactionBundle(
		[{
			type: TransactionType.AGGREGATE_COMPLETE,
			innerTransactions,
			signerPublicKey,
			fee: defaultFee,
			deadline: singleDeadline()
		}],
		{ type: bundleType }
	);

// Reads the inner transactions from a result bundle: index 0 for aggregate complete, index 1 for aggregate bonded.
const extractInnerTransactions = (bundle, isMultisig) => bundle.transactions[isMultisig ? 1 : 0].innerTransactions;

describe('TokenModule', () => {
	let tokenModule;
	let api;
	let walletController;

	beforeEach(() => {
		jest.clearAllMocks();

		api = {
			mosaic: {
				fetchAccountMosaics: jest.fn(),
				fetchMosaicOwners: jest.fn()
			}
		};

		walletController = {
			currentAccount,
			networkProperties,
			networkIdentifier: networkProperties.networkIdentifier
		};

		tokenModule = new TokenModule();
		tokenModule.init({ walletController, api });

		// The transaction deadlines are derived from the current time, which is frozen to keep them predictable.
		jest.spyOn(Date, 'now').mockReturnValue(fixedNowMilliseconds);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('has correct static name', () => {
		// Assert:
		expect(TokenModule.name).toBe('token');
	});

	describe('createTransaction()', () => {
		const createOptions = {
			initialSupply: '1000',
			divisibility: 2,
			duration: 0,
			isSupplyMutable: true,
			isTransferable: true,
			isRestrictable: false,
			isRevokable: true
		};

		// The mosaic definition and the initial supply change, both signed by the sender and referencing the derived mosaic id.
		const buildExpectedInnerTransactions = (senderPublicKey, nonce) => {
			const signerAddress = resolveSenderAddress(senderPublicKey);
			const mosaicId = mosaicIdFromNonce(signerAddress, nonce);

			return [
				{
					type: TransactionType.MOSAIC_DEFINITION,
					signerPublicKey: senderPublicKey,
					signerAddress,
					mosaicId,
					nonce,
					divisibility: createOptions.divisibility,
					duration: createOptions.duration,
					isSupplyMutable: createOptions.isSupplyMutable,
					isTransferable: createOptions.isTransferable,
					isRestrictable: createOptions.isRestrictable,
					isRevokable: createOptions.isRevokable
				},
				{
					type: TransactionType.MOSAIC_SUPPLY_CHANGE,
					signerPublicKey: senderPublicKey,
					signerAddress,
					mosaicId,
					action: MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.Increase],
					delta: relativeToAbsoluteAmount(createOptions.initialSupply, createOptions.divisibility)
				}
			];
		};

		const runCreateTransactionTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const options = withSender({ ...createOptions, nonce: config.nonce }, config.sender);

				// Act:
				const result = tokenModule.createTransaction(options);

				// Assert: an omitted nonce is generated internally, so it is read back from the result.
				const innerTransactions = extractInnerTransactions(result, config.sender.isMultisig);
				const { nonce } = innerTransactions[0];
				expect(nonce).toStrictEqual(expected.nonce ?? expect.any(Number));

				const expectedInnerTransactions = buildExpectedInnerTransactions(config.sender.publicKey, nonce);
				const expectedResult = config.sender.isMultisig
					? buildMultisigBundle(expectedInnerTransactions, TransactionBundleType.MULTISIG_TOKEN_CREATION)
					: buildAggregateCompleteBundle(
						expectedInnerTransactions,
						config.sender.publicKey,
						TransactionBundleType.TOKEN_CREATION
					);
				expectBundlesEqual(result, expectedResult);
			});
		};

		const createTransactionTests = [
			{
				description: 'creates an aggregate complete bundle with definition and initial supply for the current account',
				config: { sender: sender.currentAccount },
				expected: {}
			},
			{
				description: 'creates an aggregate bonded and hash lock bundle for a multisig account',
				config: { sender: sender.multisigAccount },
				expected: {}
			},
			{
				description: 'derives the mosaic id from a given nonce',
				config: { sender: sender.currentAccount, nonce: 1234567 },
				expected: { nonce: 1234567 }
			}
		];

		createTransactionTests.forEach(test => {
			runCreateTransactionTest(test.description, test.config, test.expected);
		});
	});

	describe('createSupplyChangeTransaction()', () => {
		const supplyChangeOptions = {
			mosaicId: token.id,
			divisibility: token.divisibility,
			delta: '5'
		};

		const runSupplyChangeTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const options = withSender({ ...supplyChangeOptions, action: config.action }, config.sender);

				// Act:
				const result = tokenModule.createSupplyChangeTransaction(options);

				// Assert:
				const expectedTransaction = {
					type: TransactionType.MOSAIC_SUPPLY_CHANGE,
					signerPublicKey: config.sender.publicKey,
					signerAddress: resolveSenderAddress(config.sender.publicKey),
					mosaicId: supplyChangeOptions.mosaicId,
					action: expected.action,
					delta: relativeToAbsoluteAmount(supplyChangeOptions.delta, supplyChangeOptions.divisibility)
				};
				const expectedResult = config.sender.isMultisig
					? buildMultisigBundle([expectedTransaction], TransactionBundleType.MULTISIG_TOKEN_SUPPLY_CHANGE)
					: buildSingleAccountBundle(expectedTransaction, TransactionBundleType.TOKEN_SUPPLY_CHANGE);
				expectBundlesEqual(result, expectedResult);
			});
		};

		const supplyChangeTests = [
			{
				description: 'creates a supply increase transaction for the current account',
				config: { sender: sender.currentAccount, action: MosaicSupplyChangeAction.Increase },
				expected: { action: MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.Increase] }
			},
			{
				description: 'creates a supply decrease transaction for the current account',
				config: { sender: sender.currentAccount, action: MosaicSupplyChangeAction.Decrease },
				expected: { action: MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.Decrease] }
			},
			{
				description: 'creates an aggregate bonded and hash lock bundle for a multisig account',
				config: { sender: sender.multisigAccount, action: MosaicSupplyChangeAction.Decrease },
				expected: { action: MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.Decrease] }
			}
		];

		supplyChangeTests.forEach(test => {
			runSupplyChangeTest(test.description, test.config, test.expected);
		});
	});

	describe('createRevocationTransaction()', () => {
		const revocationOptions = {
			mosaicId: token.id,
			divisibility: token.divisibility,
			amount: '2.5',
			sourceAddress: holderAccount.address
		};

		const runRevocationTest = (description, config) => {
			it(description, () => {
				// Act:
				const result = tokenModule.createRevocationTransaction(withSender(revocationOptions, config.sender));

				// Assert:
				const expectedTransaction = {
					type: TransactionType.MOSAIC_SUPPLY_REVOCATION,
					signerPublicKey: config.sender.publicKey,
					signerAddress: resolveSenderAddress(config.sender.publicKey),
					mosaic: {
						id: revocationOptions.mosaicId,
						amount: revocationOptions.amount,
						divisibility: revocationOptions.divisibility
					},
					sourceAddress: revocationOptions.sourceAddress
				};
				const expectedResult = config.sender.isMultisig
					? buildMultisigBundle([expectedTransaction], TransactionBundleType.MULTISIG_TOKEN_REVOCATION)
					: buildSingleAccountBundle(expectedTransaction, TransactionBundleType.TOKEN_REVOCATION);
				expectBundlesEqual(result, expectedResult);
			});
		};

		const revocationTests = [
			{
				description: 'creates a revocation transaction for the current account',
				config: { sender: sender.currentAccount }
			},
			{
				description: 'creates an aggregate bonded and hash lock bundle for a multisig account',
				config: { sender: sender.multisigAccount }
			}
		];

		revocationTests.forEach(test => {
			runRevocationTest(test.description, test.config);
		});
	});

	describe('fetchAccountTokens()', () => {
		const runFetchAccountTokensTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const accountTokens = Object.values(mosaicInfos);
				api.mosaic.fetchAccountMosaics.mockResolvedValue(accountTokens);

				// Act:
				const result = await tokenModule.fetchAccountTokens(config.address, config.searchCriteria);

				// Assert:
				expect(api.mosaic.fetchAccountMosaics).toHaveBeenCalledWith(
					networkProperties,
					expected.address,
					config.searchCriteria
				);
				expect(result).toBe(accountTokens);
			});
		};

		const fetchAccountTokensTests = [
			{
				description: 'fetches the tokens created by the current account by default',
				config: {},
				expected: { address: currentAccount.address }
			},
			{
				description: 'fetches the tokens created by a given account with search criteria',
				config: { address: holderAccount.address, searchCriteria: { pageNumber: 2, pageSize: 10 } },
				expected: { address: holderAccount.address }
			}
		];

		fetchAccountTokensTests.forEach(test => {
			runFetchAccountTokensTest(test.description, test.config, test.expected);
		});
	});

	describe('fetchMosaicOwners()', () => {
		const runFetchMosaicOwnersTest = (description, config) => {
			it(description, async () => {
				// Arrange:
				api.mosaic.fetchMosaicOwners.mockResolvedValue(mosaicOwners);

				// Act:
				const result = await tokenModule.fetchMosaicOwners(token.id, config.searchCriteria);

				// Assert:
				expect(api.mosaic.fetchMosaicOwners).toHaveBeenCalledWith(networkProperties, token.id, config.searchCriteria);
				expect(result).toBe(mosaicOwners);
			});
		};

		const fetchMosaicOwnersTests = [
			{
				description: 'fetches the accounts holding a token',
				config: {}
			},
			{
				description: 'forwards the search criteria to the api layer',
				config: { searchCriteria: { pageNumber: 2, pageSize: 10 } }
			}
		];

		fetchMosaicOwnersTests.forEach(test => {
			runFetchMosaicOwnersTest(test.description, test.config);
		});
	});

	describe('calculateTransactionFees()', () => {
		const supplyChangeOptions = {
			mosaicId: token.id,
			divisibility: token.divisibility,
			delta: '5',
			action: MosaicSupplyChangeAction.Decrease
		};

		const createSupplyChangeBundle = senderContext =>
			tokenModule.createSupplyChangeTransaction(withSender(supplyChangeOptions, senderContext));

		const runCalculateTransactionFeesTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const bundle = createSupplyChangeBundle(config.sender);

				// Act:
				const result = await tokenModule.calculateTransactionFees(bundle);

				// Assert:
				const expectedResult = bundle.transactions.map(transaction =>
					createTransactionFeeTiers(
						networkProperties,
						calculateTransactionSize(networkProperties.networkIdentifier, transaction)
					));
				expect(result).toHaveLength(expected.transactionCount);
				expect(result).toStrictEqual(expectedResult);
			});
		};

		const calculateTransactionFeesTests = [
			{
				description: 'returns a fee tier entry for a single transaction bundle',
				config: { sender: sender.currentAccount },
				expected: { transactionCount: 1 }
			},
			{
				description: 'returns a fee tier entry for each transaction of a multisig bundle',
				config: { sender: sender.multisigAccount },
				expected: { transactionCount: 2 }
			}
		];

		calculateTransactionFeesTests.forEach(test => {
			runCalculateTransactionFeesTest(test.description, test.config, test.expected);
		});
	});
});
