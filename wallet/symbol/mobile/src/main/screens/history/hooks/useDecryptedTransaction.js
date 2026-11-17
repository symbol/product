import { MessageType, SymbolTransactionType } from '@/app/constants';
import { useAsyncManager } from '@/app/hooks';
import { useEffect } from 'react';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Determines whether a transaction is a transfer carrying an encrypted message
 * that has not been decrypted yet.
 * @param {Transaction} transaction - Transaction to inspect.
 * @returns {boolean} True when the transaction has an undecrypted encrypted message.
 */
const hasUndecryptedMessage = transaction =>
	transaction?.type === SymbolTransactionType.TRANSFER
	&& transaction.message?.type === MessageType.ENCRYPTED_TEXT
	&& !transaction.message.text;

/**
 * React hook that decrypts the encrypted message of a transfer transaction.
 * Decryption runs automatically when the transaction changes.
 * Returns the transaction enriched with the decrypted message text, or the original
 * transaction unchanged when there is nothing to decrypt or decryption fails.
 * @param {WalletController} walletController - Wallet controller instance.
 * @param {Transaction} transaction - Transaction whose message should be decrypted.
 * @returns {Transaction} The transaction with message.text populated when available.
 */
export const useDecryptedTransaction = (walletController, transaction) => {
	const decryptManager = useAsyncManager({
		callback: () => walletController.modules.transfer.getDecryptedMessageText(transaction),
		defaultData: null,
		shouldShowErrorPopup: false,
		shouldClearDataOnCall: true
	});

	const { call, reset, data: decryptedText } = decryptManager;
	const hash = transaction?.hash;
	const payload = transaction?.message?.payload;

	useEffect(() => {
		if (hasUndecryptedMessage(transaction))
			call().catch(() => { /* failure handled by useAsyncManager; keep the encrypted label */ });
		else
			reset();
	}, [hash, payload]);

	// Merge the decrypted text into the current transaction.
	if (hasUndecryptedMessage(transaction) && decryptedText) {
		return { 
			...transaction, 
			message: { 
				...transaction.message, 
				text: decryptedText 
			} 
		};
	}

	return transaction;
};
