import { MessageType, TransactionType } from '../constants';
import { 
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
import { ControllerError } from 'wallet-common-core';

/** @typedef {import('../types/Transaction').Transaction} Transaction */

export class TransferModule {
	static name = 'transfer';
	#walletController;
	#api;

	constructor() {}

	init = options => {
		this.#walletController = options.walletController;
		this.#api = options.api;
	};

	loadCache = async () => {};

	resetState = () => {};

	clear = () => {};

	/**
     * Prepares a transfer transaction.
     * @param {object} options - The transfer options.
     * @param {string} options.senderPublicKey - The sender public key.
     * @param {string} options.recipientAddressOrAlias - The recipient address or alias.
     * @param {object[]} options.mosaics - The mosaics to transfer.
     * @param {string} options.messageText - The message text.
     * @param {boolean} options.isMessageEncrypted - The message encryption flag.
	 * @param {number} [options.fee=0] - The transaction fee.
     * @param {string} [password] - The wallet password.
     * @returns {Transaction} The transfer transaction.
     */
	createTransaction = async (options, password) => {
		const { recipientAddressOrAlias, mosaics, messageText, isMessageEncrypted, fee = 0 } = options;
		const { currentAccount, networkProperties } = this.#walletController;
		const senderPublicKey = options.senderPublicKey || currentAccount.publicKey;

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
			recipientAddress,
			mosaics,
			deadline: createDeadline(2, networkProperties.epochAdjustment)
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
			return {
				type: TransactionType.AGGREGATE_BONDED,
				innerTransactions: [transferTransaction],
				signerPublicKey: currentAccount.publicKey,
				fee: createFee(fee, networkProperties),
				deadline: createDeadline(48, networkProperties.epochAdjustment)
			};
		}

		// If not a multisig transaction, return transfer transaction
		transferTransaction.fee = createFee(fee, networkProperties);

		return transferTransaction;
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
