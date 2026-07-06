import {
	MosaicSupplyChangeAction,
	MosaicSupplyChangeActionMessage,
	SINGLE_TRANSACTION_DEADLINE_HOURS,
	TransactionBundleType,
	TransactionType
} from '../constants';
import {
	addressFromPublicKey,
	calculateTransactionSize,
	createDeadline,
	createMultisigAggregateBundle,
	createTransactionFee,
	createTransactionFeeTiers,
	generateNonce,
	mosaicIdFromNonce
} from '../utils';
import { TransactionBundle, relativeToAbsoluteAmount } from 'wallet-common-core';

/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Mosaic').MosaicInfo} MosaicInfo */
/** @typedef {import('../types/Network').TransactionFees} TransactionFees */
/** @typedef {import('../types/SearchCriteria').SearchCriteria} SearchCriteria */

export class TokenModule {
	static name = 'token';
	#walletController;
	#api;

	constructor() { }

	init = options => {
		this.#walletController = options.walletController;
		this.#api = options.api;
	};

	loadCache = async () => { };

	resetState = () => { };

	clear = () => { };

	/**
	 * Prepares a token creation transaction bundle.
	 * The mosaic definition and its initial supply change are wrapped in an aggregate so the token is created
	 * with the requested supply atomically. When the sender is a multisig account, the bundle contains hash lock
	 * and aggregate bonded transactions instead.
	 * @param {object} options - The token creation options.
	 * @param {string} [options.senderPublicKey] - The creator public key. Defaults to the current account.
	 * @param {number} [options.nonce] - The mosaic nonce. Defaults to a freshly generated one.
	 * @param {string} options.initialSupply - The initial supply in relative units.
	 * @param {number} options.divisibility - The token divisibility.
	 * @param {number} options.duration - The token duration in blocks. 0 means unlimited.
	 * @param {boolean} options.isSupplyMutable - Whether the supply can be changed after creation.
	 * @param {boolean} options.isTransferable - Whether the token can be transferred between accounts.
	 * @param {boolean} options.isRestrictable - Whether the token supports restrictions.
	 * @param {boolean} options.isRevokable - Whether the creator can revoke the token.
	 * @returns {TransactionBundle} The token creation transaction bundle.
	 */
	createTransaction = options => {
		const { initialSupply, divisibility, duration } = options;
		const { senderPublicKey, senderAddress, isMultisig } = this.#resolveSender(options.senderPublicKey);
		const nonce = options.nonce ?? generateNonce();
		const mosaicId = mosaicIdFromNonce(senderAddress, nonce);

		const definitionTransaction = {
			type: TransactionType.MOSAIC_DEFINITION,
			signerPublicKey: senderPublicKey,
			signerAddress: senderAddress,
			mosaicId,
			nonce,
			divisibility,
			duration,
			isSupplyMutable: options.isSupplyMutable,
			isTransferable: options.isTransferable,
			isRestrictable: options.isRestrictable,
			isRevokable: options.isRevokable
		};

		const supplyChangeTransaction = {
			type: TransactionType.MOSAIC_SUPPLY_CHANGE,
			signerPublicKey: senderPublicKey,
			signerAddress: senderAddress,
			mosaicId,
			action: MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.Increase],
			delta: relativeToAbsoluteAmount(initialSupply, divisibility)
		};

		const innerTransactions = [definitionTransaction, supplyChangeTransaction];

		if (isMultisig)
			return this.#createMultisigBundle(innerTransactions, TransactionBundleType.MULTISIG_TOKEN_CREATION);

		return this.#createAggregateCompleteBundle(innerTransactions, senderPublicKey, TransactionBundleType.TOKEN_CREATION);
	};

	/**
	 * Prepares a token supply change transaction bundle to increase or decrease the supply of an existing token.
	 * When the sender is a multisig account, the bundle contains hash lock and aggregate bonded transactions.
	 * @param {object} options - The supply change options.
	 * @param {string} [options.senderPublicKey] - The creator public key. Defaults to the current account.
	 * @param {string} options.mosaicId - The token id.
	 * @param {number} options.divisibility - The token divisibility.
	 * @param {string} options.delta - The supply change amount in relative units.
	 * @param {number} options.action - The supply change action. One of MosaicSupplyChangeAction.
	 * @returns {TransactionBundle} The supply change transaction bundle.
	 */
	createSupplyChangeTransaction = options => {
		const { mosaicId, divisibility, delta, action } = options;
		const { senderPublicKey, senderAddress, isMultisig } = this.#resolveSender(options.senderPublicKey);

		const supplyChangeTransaction = {
			type: TransactionType.MOSAIC_SUPPLY_CHANGE,
			signerPublicKey: senderPublicKey,
			signerAddress: senderAddress,
			mosaicId,
			action: MosaicSupplyChangeActionMessage[action],
			delta: relativeToAbsoluteAmount(delta, divisibility)
		};

		if (isMultisig)
			return this.#createMultisigBundle([supplyChangeTransaction], TransactionBundleType.MULTISIG_TOKEN_SUPPLY_CHANGE);

		return this.#createSingleTransactionBundle(supplyChangeTransaction, TransactionBundleType.TOKEN_SUPPLY_CHANGE);
	};

	/**
	 * Prepares a token revocation transaction bundle to reclaim a token amount from a holder back to the creator.
	 * When the sender is a multisig account, the bundle contains hash lock and aggregate bonded transactions.
	 * @param {object} options - The revocation options.
	 * @param {string} [options.senderPublicKey] - The creator public key. Defaults to the current account.
	 * @param {string} options.mosaicId - The token id.
	 * @param {number} options.divisibility - The token divisibility.
	 * @param {string} options.amount - The amount to revoke in relative units.
	 * @param {string} options.sourceAddress - The holder address to revoke the token from.
	 * @returns {TransactionBundle} The revocation transaction bundle.
	 */
	createRevocationTransaction = options => {
		const { mosaicId, divisibility, amount, sourceAddress } = options;
		const { senderPublicKey, senderAddress, isMultisig } = this.#resolveSender(options.senderPublicKey);

		const revocationTransaction = {
			type: TransactionType.MOSAIC_SUPPLY_REVOCATION,
			signerPublicKey: senderPublicKey,
			signerAddress: senderAddress,
			mosaic: {
				id: mosaicId,
				amount,
				divisibility
			},
			sourceAddress
		};

		if (isMultisig)
			return this.#createMultisigBundle([revocationTransaction], TransactionBundleType.MULTISIG_TOKEN_REVOCATION);

		return this.#createSingleTransactionBundle(revocationTransaction, TransactionBundleType.TOKEN_REVOCATION);
	};

	/**
	 * Fetches the list of tokens created by the current account or a given account.
	 * @param {string} [address] - The creator address. Defaults to the current account.
	 * @param {SearchCriteria} [searchCriteria] - Pagination params.
	 * @returns {Promise<MosaicInfo[]>} The created tokens.
	 */
	fetchAccountTokens = async (address, searchCriteria) => {
		const { currentAccount, networkProperties } = this.#walletController;
		const targetAddress = address ?? currentAccount.address;

		return this.#api.mosaic.fetchAccountMosaics(networkProperties, targetAddress, searchCriteria);
	};

	/**
	 * Calculates the transaction fees for a given transaction bundle.
	 * @param {TransactionBundle} transactionBundle - The transaction bundle.
	 * @returns {TransactionFees[]} The transaction fees for each transaction in the bundle.
	 */
	calculateTransactionFees = async transactionBundle => {
		const { networkProperties, networkIdentifier } = this.#walletController;

		return transactionBundle.transactions.map(transaction => {
			const transactionSize = calculateTransactionSize(networkIdentifier, transaction);

			return createTransactionFeeTiers(networkProperties, transactionSize);
		});
	};

	/**
	 * Resolves the sender context. When a sender public key distinct from the current account is provided,
	 * the token action is performed on behalf of that multisig account.
	 * @param {string} [senderPublicKey] - The sender public key, if any.
	 * @returns {{ senderPublicKey: string, senderAddress: string, isMultisig: boolean }} The sender context.
	 */
	#resolveSender = senderPublicKey => {
		const { currentAccount, networkIdentifier } = this.#walletController;
		const resolvedPublicKey = senderPublicKey || currentAccount.publicKey;

		return {
			senderPublicKey: resolvedPublicKey,
			senderAddress: addressFromPublicKey(resolvedPublicKey, networkIdentifier),
			isMultisig: resolvedPublicKey !== currentAccount.publicKey
		};
	};

	/**
	 * Wraps a single transaction into a bundle with fee and deadline for non-multisig announcement.
	 * @param {Transaction} transaction - The transaction.
	 * @param {string} bundleType - The transaction bundle type.
	 * @returns {TransactionBundle} The transaction bundle.
	 */
	#createSingleTransactionBundle = (transaction, bundleType) => {
		const { networkProperties } = this.#walletController;
		transaction.deadline = createDeadline(SINGLE_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment);
		transaction.fee = createTransactionFee(networkProperties, '0');

		return new TransactionBundle([transaction], { type: bundleType });
	};

	/**
	 * Wraps inner transactions into an aggregate complete bundle for non-multisig announcement.
	 * @param {Transaction[]} innerTransactions - The inner transactions.
	 * @param {string} signerPublicKey - The aggregate signer public key.
	 * @param {string} bundleType - The transaction bundle type.
	 * @returns {TransactionBundle} The transaction bundle.
	 */
	#createAggregateCompleteBundle = (innerTransactions, signerPublicKey, bundleType) => {
		const { networkProperties } = this.#walletController;

		const aggregateTransaction = {
			type: TransactionType.AGGREGATE_COMPLETE,
			innerTransactions,
			signerPublicKey,
			fee: createTransactionFee(networkProperties, '0'),
			deadline: createDeadline(SINGLE_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment)
		};

		return new TransactionBundle([aggregateTransaction], { type: bundleType });
	};

	/**
	 * Wraps inner transactions into a hash lock + aggregate bonded bundle for multisig announcement.
	 * @param {Transaction[]} innerTransactions - The inner transactions signed by the multisig account.
	 * @param {string} bundleType - The multisig transaction bundle type.
	 * @returns {TransactionBundle} The transaction bundle.
	 */
	#createMultisigBundle = (innerTransactions, bundleType) => {
		const { currentAccount, networkProperties } = this.#walletController;

		return createMultisigAggregateBundle(innerTransactions, {
			currentAccount,
			networkProperties,
			metadata: { type: bundleType }
		});
	};
}
