
import {
	MULTISIG_TRANSACTION_DEADLINE_HOURS,
	MessageType,
	NativeMessageType,
	SINGLE_TRANSACTION_DEADLINE_HOURS,
	TransactionBundleType,
	TransactionType
} from '../constants';
import {
	calculateTotalTransactionFee,
	calculateTransactionFee,
	createDeadline,
	createTransactionFee,
	createTransactionFeeTiers,
	encodePlainMessage,
	isIncomingTransaction,
	isNemAddress,
	isOutgoingTransaction
} from '../utils';
import { ControllerError, TransactionBundle } from 'wallet-common-core';

/** @typedef {import('../types/Network').TransactionFees} TransactionFees */
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
	 * Creates an unsigned TransactionBundle for a NEM transfer or multisig transfer.
	 * The bundle is returned unsigned; the caller signs and announces it.
	 * The fee is not calculated here — call calculateTransactionFees to get fee tiers
	 * and pass the selected tier as options.fee.
	 * @param {object} options - Transfer options.
	 * @param {string} options.recipientAddress - Recipient NEM address.
	 * @param {object[]} options.mosaics - Mosaics to transfer.
	 * @param {string} [options.message] - Message text.
	 * @param {boolean} [options.isEncrypted] - Whether to encrypt the message.
	 * @param {string} [options.senderPublicKey] - Sender (multisig account) public key. When it differs from the
	 * current account, the transfer is wrapped in a multisig transaction signed by the current account (cosignatory).
	 * @param {object} [options.fee] - The fee object. If omitted, defaults to 0.
	 * @param {string} [password] - Wallet password (required for encrypted messages).
	 * @returns {Promise<TransactionBundle>} The unsigned transfer (or multisig-wrapped transfer) bundle.
	 */
	createTransaction = async (options, password) => {
		const {
			recipientAddress,
			mosaics,
			message,
			isEncrypted,
			fee
		} = options;

		const { currentAccount, networkProperties } = this.#walletController;
		const senderPublicKey = options.senderPublicKey || currentAccount.publicKey;
		const isMultisig = senderPublicKey !== currentAccount.publicKey;

		if (!isNemAddress(recipientAddress, networkProperties.networkIdentifier)) {
			throw new ControllerError(
				'error_transfer_invalid_recipient',
				`Invalid NEM recipient address: "${recipientAddress}"`
			);
		}

		let messagePayload = null;
		if (message) {
			if (isEncrypted) {
				const recipientPublicKey = await this.#resolveRecipientPublicKey(networkProperties, recipientAddress);
				const encryptedHex = await this.#walletController.encryptMessage(message, recipientPublicKey, password);
				messagePayload = {
					type: MessageType.ENCRYPTED,
					text: message,
					payload: encryptedHex,
					native: { type: NativeMessageType.EncryptedText }
				};
			} else {
				messagePayload = {
					type: MessageType.PLAIN,
					text: message,
					payload: encodePlainMessage(message),
					native: { type: NativeMessageType.PlainText }
				};
			}
		}

		const transferTransaction = {
			type: TransactionType.TRANSFER,
			signerPublicKey: senderPublicKey,
			recipientAddress,
			mosaics: mosaics || [],
			message: messagePayload,
			fee: fee ?? createTransactionFee(networkProperties, '0'),
			deadline: createDeadline(networkProperties.networkTime, SINGLE_TRANSACTION_DEADLINE_HOURS)
		};

		if (isMultisig) {
			// NEM serializes a fee on BOTH the multisig wrapper and the wrapped transaction, and the
			// network charges the sum to the multisig account (NEM Technical Reference §4.3.3).
			const innerFeeAmount = calculateTransactionFee(transferTransaction, networkProperties);
			transferTransaction.fee = createTransactionFee(networkProperties, innerFeeAmount);

			const outerTransaction = {
				type: TransactionType.MULTISIG,
				signerPublicKey: currentAccount.publicKey,
				innerTransaction: transferTransaction,
				fee: createTransactionFee(networkProperties, '0'),
				deadline: createDeadline(networkProperties.networkTime, MULTISIG_TRANSACTION_DEADLINE_HOURS)
			};
			const wrapperFeeAmount = calculateTransactionFee(outerTransaction, networkProperties);
			outerTransaction.fee = createTransactionFee(networkProperties, wrapperFeeAmount);

			return new TransactionBundle([outerTransaction], { type: TransactionBundleType.MULTISIG_TRANSFER });
		}

		return new TransactionBundle([transferTransaction], { type: TransactionBundleType.DEFAULT });
	};

	/**
	 * Calculates the transaction fee tiers for each transaction in the bundle.
	 * Fees are derived from the transaction content (type, mosaics, message).
	 * NEM fees are deterministic, so fast/medium/slow tiers are equal.
	 * @param {TransactionBundle} transactionBundle - The transaction bundle.
	 * @returns {Promise<TransactionFees[]>} The transaction fee tiers for each transaction in the bundle.
	 */
	calculateTransactionFees = async transactionBundle => {
		const { networkProperties } = this.#walletController;

		return transactionBundle.transactions.map(transaction => {
			const feeAmount = calculateTotalTransactionFee(transaction, networkProperties);

			return createTransactionFeeTiers(networkProperties, feeAmount);
		});
	};

	/**
	 * Decrypts the message of a transfer transaction for display. Returns the plain text directly for a
	 * non-encrypted message; for an encrypted message, decrypts using the counterparty public key (the
	 * signer for an incoming transaction, the recipient for an outgoing one).
	 * @param {Transaction} transaction - The transfer transaction containing the message.
	 * @param {string} [password] - The wallet password.
	 * @returns {Promise<string>} The decrypted (or plain) message text.
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

		if (message.type !== MessageType.ENCRYPTED)
			return message.text ?? '';

		if (isIncomingTransaction(transaction, currentAccount))
			return this.#walletController.decryptMessage(message.payload, signerPublicKey, password);

		if (isOutgoingTransaction(transaction, currentAccount)) {
			const recipientAccount = await this.#api.account.fetchAccountInfo(networkProperties, recipientAddress);

			return this.#walletController.decryptMessage(message.payload, recipientAccount.publicKey, password);
		}

		throw new ControllerError(
			'error_failed_decrypt_message_not_related',
			'Failed to decrypt message. Transaction is not related to the current account'
		);
	};

	/** @private */
	#resolveRecipientPublicKey = async (networkProperties, recipientAddress) => {
		const accountInfo = await this.#api.account.fetchAccountInfo(networkProperties, recipientAddress);
		if (!accountInfo.publicKey) {
			throw new ControllerError(
				'error_transfer_encrypted_message_no_recipient_public_key',
				`Cannot encrypt message: recipient public key for "${recipientAddress}" is unknown`
			);
		}
		return accountInfo.publicKey;
	};
}

