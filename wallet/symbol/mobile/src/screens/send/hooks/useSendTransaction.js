import { MessageType } from '@/app/constants';
import { $t } from '@/app/localization';
import { objectToTableData } from '@/app/utils';
import { constants as symbolConstants } from 'wallet-common-symbol';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Table').TableData} TableData */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Token').Token} Token */

/**
 * Return type for useSendTransaction hook.
 * @typedef {object} UseSendTransactionReturnType
 * @property {() => Promise<Transaction>} createTransaction - Creates a transfer transaction.
 * @property {(transaction: Transaction) => TableData} getTransactionPreviewTable
 *   - Generates preview table data for the confirmation dialog.
 */

/**
 * React hook for creating transfer transactions and generating preview data.
 * @param {object} params - Hook parameters.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {string} params.senderAddress - The sender account address.
 * @param {string} params.senderPublicKey - The sender public key.
 * @param {string} params.recipientAddress - The recipient account address.
 * @param {Token[]} params.tokens - Array of tokens to transfer.
 * @param {string} params.messageText - The message text.
 * @param {boolean} params.isMessageEncrypted - Whether the message should be encrypted.
 * @returns {UseSendTransactionReturnType}
 */
export const useSendTransaction = ({
	walletController,
	senderAddress,
	senderPublicKey,
	recipientAddress,
	tokens,
	messageText,
	isMessageEncrypted
}) => {
	/**
	 * Creates a transfer transaction.
	 * @returns {Promise<Transaction>}
	 */
	const createTransaction = async () => {
		const transactionBundle = await walletController.modules.transfer.createTransaction({
			senderAddress,
			senderPublicKey,
			recipientAddress,
			tokens,
			mosaics: tokens,
			messageText,
			isMessageEncrypted
		});

		return transactionBundle;
	};

	/**
	 * Generates preview table data for the transaction confirmation dialog.
	 * @param {Transaction} transaction - The transaction to preview.
	 * @returns {TableData}
	 */
	const getTransactionPreviewTable = transaction => {
		if (symbolConstants.TransactionType.HASH_LOCK === transaction.type) {
			const hashLockData = {
				type: transaction.type,
				description: $t('form_transfer_hash_lock_description', {
					lockedAmount: transaction.lockedAmount,
					duration: transaction.duration
				}),
				fee: transaction.fee
			};

			return objectToTableData(hashLockData);
		}

		const transfer = transaction.innerTransactions ? transaction.innerTransactions[0] : transaction;

		const data = {
			type: transfer.type,
			sender: transfer.signerAddress,
			recipientAddress: transfer.recipientAddress
		};

		if (transfer.message) {
			data.messageText = transfer.message.text;
			data.isMessageEncrypted = transfer.message.type === MessageType.ENCRYPTED_TEXT;
		}

		data.mosaics = transfer.mosaics ?? transfer.tokens;
		data.fee = transaction.fee;

		return objectToTableData(data);
	};

	return {
		createTransaction,
		getTransactionPreviewTable
	};
};
