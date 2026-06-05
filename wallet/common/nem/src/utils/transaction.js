import { transactionToNem } from './transaction-to-nem';
import {
	BASE_FEE,
	NEM_EPOCH,
	NETWORK_CURRENCY_DIVISIBILITY,
	NETWORK_CURRENCY_ID,
	SINGLE_TRANSACTION_DEADLINE_HOURS,
	TransactionType
} from '../constants';
import { PrivateKey, PublicKey } from 'symbol-sdk';
import { MessageEncoder, NemFacade } from 'symbol-sdk/nem';
import { SdkError, TransactionBundle } from 'wallet-common-core';

/** @typedef {import('../types/Transaction').SignedTransaction} SignedTransaction */
/** @typedef {import('../types/Transaction').CosignedTransaction} CosignedTransaction */
/** @typedef {import('../types/Transaction').Deadline} Deadline */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

/**
 * Converts a NEM timestamp (seconds since the NEM epoch) to a Unix timestamp in milliseconds.
 * @param {number} nemTimestamp - The NEM timestamp in seconds.
 * @returns {number} The Unix timestamp in milliseconds.
 */
export const nemTimestampToDate = nemTimestamp => (nemTimestamp * 1000) + NEM_EPOCH;

/**
 * Creates a deadline object from the current network time, computed at compose time.
 * `timestamp` is the UI-ready expiry (Unix ms); `adjusted` carries the SDK-ready NEM-second
 * creation `timestamp` and expiry `deadline`.
 * @param {number} networkTime - The NEM network time in milliseconds since the NEM epoch.
 * @param {number} [deadlineHours] - The deadline window in hours.
 * @returns {Deadline} The deadline object.
 */
export const createDeadline = (networkTime, deadlineHours = SINGLE_TRANSACTION_DEADLINE_HOURS) => {
	const timestamp = Math.floor(networkTime / 1000);
	const deadline = timestamp + (deadlineHours * 3600);

	return {
		timestamp: nemTimestampToDate(deadline),
		adjusted: { timestamp, deadline }
	};
};

/**
 * Normalizes a NEM transaction hash by ensuring it is uppercase.
 * @param {string} hash - The transaction hash to normalize.
 * @returns {string} The normalized transaction hash.
 */
export const normalizeTransactionHash = hash => {
	if (typeof hash !== 'string')
		throw new TypeError('Expected hash to be a string value');
	
	return hash.toUpperCase();
};

/**
 * Returns true if the transaction is a NEM multisig wrapper (type 4100).
 * @param {Transaction | object} transaction - The transaction or NEM transaction object.
 * @returns {boolean} A boolean indicating whether the transaction is a multisig transaction.
 */
export const isMultisigTransaction = transaction => transaction.type === TransactionType.MULTISIG;

/**
 * Returns true if the transaction was sent by the given account.
 * @param {Transaction} transaction - The transaction object.
 * @param {{ address: string }} currentAccount - The current account.
 * @returns {boolean} A boolean indicating whether the transaction is an outgoing transaction.
 */
export const isOutgoingTransaction = (transaction, currentAccount) =>
	transaction.signerAddress === currentAccount.address;

/**
 * Returns true if the transaction was received by the given account.
 * @param {Transaction} transaction - The transaction object.
 * @param {{ address: string }} currentAccount - The current account.
 * @returns {boolean} A boolean indicating whether the transaction is an incoming transaction.
 */
export const isIncomingTransaction = (transaction, currentAccount) =>
	transaction.recipientAddress === currentAccount.address;

/**
 * Encodes a plain text message as a NEM message payload hex string (the raw on-chain message bytes).
 * @param {string} messageText - The plain text message to encode.
 * @returns {string} The encoded message payload hex string.
 */
export const encodePlainMessage = messageText => {
	const bytes = new TextEncoder().encode(messageText);
	
	return Buffer.from(bytes).toString('hex');
};

/**
 * Decodes a plain text message from a NEM message payload hex string (the raw on-chain message bytes).
 * @param {string} messagePayloadHex - The message payload hex string.
 * @returns {string} The decoded plain text message.
 */
export const decodePlainMessage = messagePayloadHex => {
	const bytes = Buffer.from(messagePayloadHex, 'hex');

	return bytes.toString('utf-8');
};

/**
 * Encrypts a message using NEM's deprecated AES-CBC encryption.
 * @param {string} messageText - The plain text message to encrypt.
 * @param {string} recipientPublicKey - The recipient's public key.
 * @param {string} privateKey - The sender's private key.
 * @returns {string} The encrypted message payload hex string.
 */
export const encryptMessage = (messageText, recipientPublicKey, privateKey) => {
	const keyPair = new NemFacade.KeyPair(new PrivateKey(privateKey));
	const messageEncoder = new MessageEncoder(keyPair);
	const messageBytes = Buffer.from(messageText, 'utf-8');
	const encodedBytes = messageEncoder.encodeDeprecated(new PublicKey(recipientPublicKey), messageBytes);

	return Buffer.from(encodedBytes).toString('hex');
};

/**
 * Decrypts a NEM-encrypted message.
 * @param {string} encryptedMessageHex - The encrypted message payload hex string.
 * @param {string} senderOrRecipientPublicKey - The public key of the other party (sender or recipient).
 * @param {string} privateKey - The current account's private key.
 * @returns {string} The decrypted message text.
 */
export const decryptMessage = (encryptedMessageHex, senderOrRecipientPublicKey, privateKey) => {
	const keyPair = new NemFacade.KeyPair(new PrivateKey(privateKey));
	const messageEncoder = new MessageEncoder(keyPair);
	const encodedBytes = Buffer.from(encryptedMessageHex, 'hex');
	const { message } = messageEncoder.tryDecodeDeprecated(
		new PublicKey(senderOrRecipientPublicKey),
		encodedBytes
	);

	return Buffer.from(message).toString('utf-8');
};

/**
 * Signs a NEM transaction and returns a SignedTransaction.
 * @param {string} networkIdentifier - The network identifier.
 * @param {Transaction} transaction - The transaction to sign.
 * @param {string} privateKey - The signer's private key.
 * @returns {SignedTransaction} The signed transaction.
 */
export const signTransaction = (networkIdentifier, transaction, privateKey) => {
	const facade = new NemFacade(networkIdentifier);
	const keyPair = new NemFacade.KeyPair(new PrivateKey(privateKey));

	// signerPublicKey must be set in the descriptor BEFORE transactionFactory.create()
	// because the SDK pre-computes `size` at creation time; overriding afterward corrupts serialization.
	const txWithSigner = transaction.signerPublicKey
		? transaction
		: { ...transaction, signerPublicKey: keyPair.publicKey.toString() };

	const networkCurrency = { mosaicId: NETWORK_CURRENCY_ID, divisibility: NETWORK_CURRENCY_DIVISIBILITY };
	const nemTransaction = transactionToNem(txWithSigner, {
		networkProperties: { networkIdentifier, networkCurrency }
	});

	const signature = facade.signTransaction(keyPair, nemTransaction);
	const hash = facade.hashTransaction(nemTransaction);

	// The announce `data` must be the non-verifiable serialization (without the signature field). The SDK's
	// attachSignature returns the `{ data, signature }` payload NIS expects; raw serialize() embeds an empty
	// signature field that shifts every later field, so NIS rejects the transaction (no recipient).
	const dto = JSON.parse(facade.transactionFactory.constructor.attachSignature(nemTransaction, signature));

	return {
		hash: hash.toString(),
		dto
	};
};

/**
 * Signs all transactions in a TransactionBundle.
 * @param {string} networkIdentifier - The network identifier.
 * @param {import('wallet-common-core').TransactionBundle} transactionBundle - The bundle of transactions to sign.
 * @param {string} privateKey - The signer's private key.
 * @returns {import('wallet-common-core').TransactionBundle} The bundle of signed transactions.
 */
export const signTransactionBundle = (networkIdentifier, transactionBundle, privateKey) => {
	const signedTransactions = transactionBundle.transactions.map(transaction =>
		signTransaction(networkIdentifier, transaction, privateKey));

	return new TransactionBundle(signedTransactions, transactionBundle.metadata);
};

/**
 * Creates and signs a NEM multisig cosignature transaction.
 * Unlike Symbol, a NEM cosignature is itself a transaction, so its deadline is created from the network
 * time at cosign time (via createDeadline) rather than being a detached signature over the hash.
 * @param {object} transaction - The transaction to cosign. Must contain `hash`, `multisigAccountAddress`,
 * `networkIdentifier`, and `networkTime`.
 * @param {string} privateKey - The cosigner's private key.
 * @returns {CosignedTransaction} The cosigned transaction.
 */
export const cosignTransaction = (transaction, privateKey) => {
	const { networkIdentifier = 'mainnet', hash, multisigAccountAddress, networkTime } = transaction;

	if (!hash || !multisigAccountAddress)
		throw new SdkError('cosignTransaction requires hash and multisigAccountAddress on the transaction object');

	const facade = new NemFacade(networkIdentifier);
	const keyPair = new NemFacade.KeyPair(new PrivateKey(privateKey));
	const { adjusted } = createDeadline(networkTime);

	const cosignatureTransaction = facade.transactionFactory.create({
		type: 'cosignature_v1',
		signerPublicKey: keyPair.publicKey.toString(),
		fee: BigInt(BASE_FEE),
		timestamp: adjusted.timestamp,
		deadline: adjusted.deadline,
		multisigAccountAddress,
		otherTransactionHash: hash
	});

	const signature = facade.signTransaction(keyPair, cosignatureTransaction);
	const cosignHash = facade.hashTransaction(cosignatureTransaction);
	const dto = JSON.parse(facade.transactionFactory.constructor.attachSignature(cosignatureTransaction, signature));

	return {
		hash: cosignHash.toString(),
		signerPublicKey: keyPair.publicKey.toString(),
		dto
	};
};
