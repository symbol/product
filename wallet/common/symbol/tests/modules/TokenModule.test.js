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
import { networkProperties } from '../__fixtures__/local/network';
import { currentAccount, walletStorageAccounts } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { TransactionBundle, relativeToAbsoluteAmount } from 'wallet-common-core';

const multisigAccount = walletStorageAccounts.testnet[1];
const holderAccount = walletStorageAccounts.testnet[2];
const FIXED_NOW_MS = 1_700_000_000_000;
const TOKEN_ID = '78C3CDF0896248DB';

const defaultFee = createTransactionFee(networkProperties, '0');
const singleDeadline = () => createDeadline(SINGLE_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment);
const multisigDeadline = () => createDeadline(MULTISIG_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment);
const resolveSenderAddress = publicKey => addressFromPublicKey(publicKey, networkProperties.networkIdentifier);

const SENDER = {
	currentAccount: { publicKey: currentAccount.publicKey, isMultisig: false },
	multisigAccount: { publicKey: multisigAccount.publicKey, isMultisig: true }
};

const withSender = (options, sender) =>
	(sender.isMultisig ? { ...options, senderPublicKey: sender.publicKey } : options);

const expectBundlesEqual = (result, expectedResult) =>
	expect(result.toJSON()).toStrictEqual(expectedResult.toJSON());

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
const extractInnerTransactions = (bundle, isMultisig) =>
	bundle.transactions[isMultisig ? 1 : 0].innerTransactions;

describe('TokenModule', () => {
	let tokenModule;
	let api;
	let walletController;

	beforeEach(() => {
		api = {
			mosaic: {
				fetchAccountMosaics: jest.fn()
			}
		};

		walletController = {
			currentAccount,
			networkProperties,
			networkIdentifier: networkProperties.networkIdentifier
		};

		tokenModule = new TokenModule();
		tokenModule.init({ walletController, api });
		jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
		jest.clearAllMocks();
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

		// The mosaic definition + initial supply change signed by the sender, referencing the derived mosaic id.
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

		const runCreateTransactionTest = sender => {
			// Act:
			const result = tokenModule.createTransaction(withSender(createOptions, sender));

			// Assert: the nonce is generated internally, so the expected mosaic id is derived from the result.
			const { nonce } = extractInnerTransactions(result, sender.isMultisig)[0];
			const expectedInner = buildExpectedInnerTransactions(sender.publicKey, nonce);
			const expectedResult = sender.isMultisig
				? buildMultisigBundle(expectedInner, TransactionBundleType.MULTISIG_TOKEN_CREATION)
				: buildAggregateCompleteBundle(expectedInner, sender.publicKey, TransactionBundleType.TOKEN_CREATION);

			expectBundlesEqual(result, expectedResult);
		};

		it('creates an aggregate complete bundle with definition and initial supply for the current account', () => {
			runCreateTransactionTest(SENDER.currentAccount);
		});

		it('creates an aggregate bonded + hash lock bundle for a multisig account', () => {
			runCreateTransactionTest(SENDER.multisigAccount);
		});
	});

	describe('createSupplyChangeTransaction()', () => {
		const supplyChangeOptions = {
			mosaicId: TOKEN_ID,
			divisibility: 2,
			delta: '5',
			action: MosaicSupplyChangeAction.Decrease
		};

		const buildExpectedTransaction = senderPublicKey => ({
			type: TransactionType.MOSAIC_SUPPLY_CHANGE,
			signerPublicKey: senderPublicKey,
			signerAddress: resolveSenderAddress(senderPublicKey),
			mosaicId: supplyChangeOptions.mosaicId,
			action: MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.Decrease],
			delta: relativeToAbsoluteAmount(supplyChangeOptions.delta, supplyChangeOptions.divisibility)
		});

		const runSupplyChangeTest = sender => {
			// Act:
			const result = tokenModule.createSupplyChangeTransaction(withSender(supplyChangeOptions, sender));

			// Assert:
			const expectedTransaction = buildExpectedTransaction(sender.publicKey);
			const expectedResult = sender.isMultisig
				? buildMultisigBundle([expectedTransaction], TransactionBundleType.MULTISIG_TOKEN_SUPPLY_CHANGE)
				: buildSingleAccountBundle(expectedTransaction, TransactionBundleType.TOKEN_SUPPLY_CHANGE);

			expectBundlesEqual(result, expectedResult);
		};

		it('creates a bare supply change transaction for the current account', () => {
			runSupplyChangeTest(SENDER.currentAccount);
		});

		it('creates an aggregate bonded + hash lock bundle for a multisig account', () => {
			runSupplyChangeTest(SENDER.multisigAccount);
		});
	});

	describe('createRevocationTransaction()', () => {
		const revocationOptions = {
			mosaicId: TOKEN_ID,
			divisibility: 2,
			amount: '2.5',
			sourceAddress: holderAccount.address
		};

		const buildExpectedTransaction = senderPublicKey => ({
			type: TransactionType.MOSAIC_SUPPLY_REVOCATION,
			signerPublicKey: senderPublicKey,
			signerAddress: resolveSenderAddress(senderPublicKey),
			mosaic: {
				id: revocationOptions.mosaicId,
				amount: revocationOptions.amount,
				divisibility: revocationOptions.divisibility
			},
			sourceAddress: revocationOptions.sourceAddress
		});

		const runRevocationTest = sender => {
			// Act:
			const result = tokenModule.createRevocationTransaction(withSender(revocationOptions, sender));

			// Assert:
			const expectedTransaction = buildExpectedTransaction(sender.publicKey);
			const expectedResult = sender.isMultisig
				? buildMultisigBundle([expectedTransaction], TransactionBundleType.MULTISIG_TOKEN_REVOCATION)
				: buildSingleAccountBundle(expectedTransaction, TransactionBundleType.TOKEN_REVOCATION);

			expectBundlesEqual(result, expectedResult);
		};

		it('creates a bare revocation transaction for the current account', () => {
			runRevocationTest(SENDER.currentAccount);
		});

		it('creates an aggregate bonded + hash lock bundle for a multisig account', () => {
			runRevocationTest(SENDER.multisigAccount);
		});
	});

	describe('fetchAccountTokens()', () => {
		const runFetchAccountTokensTest = async (config, expected) => {
			// Arrange:
			const expectedTokens = [{ id: TOKEN_ID }];
			api.mosaic.fetchAccountMosaics.mockResolvedValue(expectedTokens);

			// Act:
			const result = await tokenModule.fetchAccountTokens(config.address, config.searchCriteria);

			// Assert:
			expect(api.mosaic.fetchAccountMosaics).toHaveBeenCalledWith(
				networkProperties,
				expected.address,
				config.searchCriteria
			);
			expect(result).toBe(expectedTokens);
		};

		it('fetches created tokens for the current account by default', async () => {
			await runFetchAccountTokensTest({}, { address: currentAccount.address });
		});

		it('fetches created tokens for a given address with search criteria', async () => {
			await runFetchAccountTokensTest(
				{ address: holderAccount.address, searchCriteria: { pageNumber: 2, pageSize: 10 } },
				{ address: holderAccount.address }
			);
		});
	});

	describe('calculateTransactionFees()', () => {
		it('returns a fee tier entry for each transaction in the bundle', async () => {
			// Arrange:
			const bundle = tokenModule.createSupplyChangeTransaction({
				mosaicId: TOKEN_ID,
				divisibility: 2,
				delta: '5',
				action: MosaicSupplyChangeAction.Decrease
			});
			const expectedResult = bundle.transactions.map(transaction =>
				createTransactionFeeTiers(networkProperties, calculateTransactionSize(networkProperties.networkIdentifier, transaction)));

			// Act:
			const result = await tokenModule.calculateTransactionFees(bundle);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		});
	});
});
