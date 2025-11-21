import { MessageType, TransactionBundleType, TransactionType } from '../constants';
import {
	addressFromPublicKey,
	calculateTransactionSize,
	createDeadline,
	createTransactionFee,
	createTransactionFeeTiers,
	encodePlainMessage,
	isIncomingTransaction,
	isOutgoingTransaction,
	isSymbolAddress,
	namespaceIdFromName
} from '../utils';
import { ControllerError, TransactionBundle } from 'wallet-common-core';

/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Network').TransactionFees} TransactionFees */

const SINGLE_TRANSACTION_DEADLINE_HOURS = 2;
const MULTISIG_TRANSACTION_DEADLINE_HOURS = 48;
const EMPTY_AGGREGATE_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
const HASH_LOCK_AMOUNT = '10';
const HASH_LOCK_DURATION = 1000;

export class TransferModule {
	static name = 'transfer';
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
	 * Prepares a transfer transaction bundle.
	 * Depending on the sender and current account, it can be a simple transfer transaction or multisig transaction.
	 * In case of multisig transaction - the bundle will contain hash lock and aggregate bonded transactions.
	 * The hash lock transaction needs to be announced first, followed by the aggregate bonded transaction after confirmation.
	 * @param {object} options - The transfer options.
	 * @param {string} options.senderPublicKey - The sender public key.
	 * @param {string} options.recipientAddress - The recipient address or alias.
	 * @param {object[]} options.mosaics - The mosaics to transfer.
	 * @param {string} options.messageText - The message text.
	 * @param {boolean} options.isMessageEncrypted - The message encryption flag.
	 * @param {number} [options.fee] - The transaction fee.
	 * @param {string} [password] - The wallet password.
	 * @returns {TransactionBundle} The transfer transaction bundle.
	 */
	createTransaction = async (options, password) => {
		const { recipientAddress: recipientAddressOrAlias, mosaics, messageText, isMessageEncrypted, fee } = options;
		const { currentAccount, networkProperties } = this.#walletController;
		const senderPublicKey = options.senderPublicKey || currentAccount.publicKey;
		const senderAddress = addressFromPublicKey(senderPublicKey, networkProperties.networkIdentifier);

		// Resolve recipient address
		let recipientAddress;
		if (isSymbolAddress(recipientAddressOrAlias)) {
			recipientAddress = recipientAddressOrAlias;
		} else {
			const namespaceId = namespaceIdFromName(recipientAddressOrAlias.toLowerCase());
			recipientAddress = await this.#api.namespace.resolveAddress(networkProperties, namespaceId);
		}

		if (!recipientAddress) {
			throw new ControllerError(
				'error_transfer_unknown_recipient',
				`Failed to create transfer transaction. Recipient address not found for provided alias "${recipientAddressOrAlias}"`
			);
		}

		// If message is encrypted, fetch recipient publicKey
		let messagePayloadHex = null;
		if (messageText && isMessageEncrypted) {
			const recipientAccount = await this.#api.account.fetchAccountInfo(networkProperties, recipientAddress);
			messagePayloadHex = await this.#walletController.encryptMessage(messageText, recipientAccount.publicKey, password);
		}
		// If message is not encrypted, encode plain message
		else if (messageText) {
			messagePayloadHex = encodePlainMessage(messageText);
		}

		// Prepare transfer transaction
		const transferTransaction = {
			type: TransactionType.TRANSFER,
			signerPublicKey: senderPublicKey,
			signerAddress: senderAddress,
			recipientAddress,
			mosaics,
			deadline: createDeadline(SINGLE_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment)
		};

		if (messagePayloadHex) {
			transferTransaction.message = {
				text: messageText,
				payload: messagePayloadHex,
				type: isMessageEncrypted ? MessageType.EncryptedText : MessageType.PlainText
			};
		}

		// If multisig transaction, return aggregate bonded transaction
		const isMultisigTransaction = senderPublicKey !== currentAccount.publicKey;
		if (isMultisigTransaction) {
			const lockedAmount = HASH_LOCK_AMOUNT;
			const hashLockTransaction = {
				type: TransactionType.HASH_LOCK,
				signerPublicKey: currentAccount.publicKey,
				mosaic: {
					id: networkProperties.networkCurrency.mosaicId,
					amount: lockedAmount,
					divisibility: networkProperties.networkCurrency.divisibility
				},
				lockedAmount,
				duration: HASH_LOCK_DURATION,
				fee: fee ?? createTransactionFee(networkProperties, '0'),
				deadline: createDeadline(SINGLE_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment),
				aggregateHash: EMPTY_AGGREGATE_HASH
			};
			const aggregateBondedTransaction = {
				type: TransactionType.AGGREGATE_BONDED,
				innerTransactions: [transferTransaction],
				signerPublicKey: currentAccount.publicKey,
				signerAddress: currentAccount.address,
				fee: fee ?? createTransactionFee(networkProperties, '0'),
				deadline: createDeadline(MULTISIG_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment)
			};

			return new TransactionBundle(
				[hashLockTransaction, aggregateBondedTransaction], 
				{ type: TransactionBundleType.MULTISIG_TRANSFER }
			);
		}

		// If not a multisig transaction, return transfer transaction
		transferTransaction.fee = fee ?? createTransactionFee(networkProperties, '0');

		return new TransactionBundle([transferTransaction], { type: TransactionBundleType.DEFAULT });
	};

	/**
	 * Decrypts the message payload of a transaction.
	 * @param {Transaction} transaction - The transaction.
	 * @param {string} [password] - The wallet password.
	 * @returns {string} The decrypted message text.
	 */
	getDecryptedMessageText = async (transaction, password) => {
		const { currentAccount, networkProperties } = this.#walletController;

		if (transaction.type !== TransactionType.TRANSFER) {
			throw new ControllerError(
				'error_failed_decrypt_message_invalid_transaction_type',
				`Failed to decrypt message. Transaction type "${transaction.type}" is not supported. `
				+ `Expected type "${TransactionType.TRANSFER}"`
			);
		}

		const { message, recipientAddress, signerPublicKey } = transaction;

		if (!message.type === MessageType.EncryptedText)
			return message.payload;

		if (isIncomingTransaction(transaction, currentAccount))
			return this.#walletController.decryptMessage(message.payload, signerPublicKey, password);

		if (isOutgoingTransaction(transaction, currentAccount)) {
			const recipientAccount = await this.#api.account.fetchAccountInfo(networkProperties, recipientAddress);

			return this.#walletController.decryptMessage(message.payload, recipientAccount.publicKey, password);
		}

		throw new ControllerError(
			'error_failed_decrypt_message_not_related',
			'Failed to decrypt message. Transaction is not related to current account'
		);
	};

	/**
	 * Calculates the transaction fees for a given transaction.
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
}
