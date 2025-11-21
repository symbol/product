import { TransactionBundle } from 'wallet-common-core';
import { transactionToEthereum } from './transaction-to-ethereum';
import { ethers } from 'ethers';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Network').TransactionFees} TransactionFees */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').SignedTransaction} SignedTransaction */


/**
 * Checks if a transaction is an outgoing transaction.
 * @param {Transaction} transaction - Transaction.
 * @param {PublicAccount} currentAccount - Current account.
 * @returns {boolean} A boolean indicating whether the transaction is an outgoing transaction.
 */
export const isOutgoingTransaction = (transaction, currentAccount) => transaction.signerAddress === currentAccount.address;

/**
 * Checks if a transaction is an incoming transaction.
 * @param {Transaction} transaction - Transaction.
 * @param {PublicAccount} currentAccount - Current account.
 * @returns {boolean} A boolean indicating whether the transaction is an incoming transaction.
 */
export const isIncomingTransaction = (transaction, currentAccount) => transaction.recipientAddress === currentAccount.address;


/**
 * Signs an Ethereum transaction with a private key (EIP-155/EIP-1559).
 * @param {string} networkIdentifier - The network identifier.
 * @param {Transaction} transaction - App transaction object.
 * @param {string} privateKey - The signer account private key.
 * @returns {Promise<SignedTransaction>} The signed transaction.
 */
export const signTransaction = async (networkIdentifier, transaction, privateKey) => {
	const ethereumTransaction = transactionToEthereum(transaction, { networkIdentifier });

	const wallet = new ethers.Wallet(privateKey);
	const signedTransactionString = await wallet.signTransaction(ethereumTransaction);
	const hash = ethers.keccak256(signedTransactionString);

	return {
		dto: signedTransactionString,
		hash
	};
};

/**
 * Signs a transaction bundle with a private key.
 * @param {string} networkIdentifier - The network identifier.
 * @param {TransactionBundle} transactionBundle - The transaction bundle object.
 * @param {string} privateKey - The signer account private key.
 * @returns {TransactionBundle} The signed transaction bundle.
 */
export const signTransactionBundle = async (networkIdentifier, transactionBundle, privateKey) => {
	const signedTransactions = await Promise.all(transactionBundle.transactions.map(tx => signTransaction(networkIdentifier, tx, privateKey)));

	return new TransactionBundle(signedTransactions, transactionBundle.metadata);
};

/**
 * Encodes a plain text message into a payload HEX string.
 * @param {string} messageText - The message text.
 * @returns {string} The resulting payload HEX string.
 */
export const encodePlainMessage = messageText => {
	const bytes = new TextEncoder().encode(messageText);

	return Buffer.from([...bytes]).toString('hex');
};

/**
 * Decodes a plain text message from a payload HEX string.
 * @param {string} messagePayloadHex - The message payload HEX string.
 * @returns {string} The resulting message text.
 */
export const decodePlainMessage = messagePayloadHex => {
	const messageBytes = Buffer.from(messagePayloadHex, 'hex');

	return Buffer.from(messageBytes).toString();
};
