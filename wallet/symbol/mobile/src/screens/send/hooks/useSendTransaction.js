import { MessageType, SymbolTransactionType } from '@/app/constants';
import { $t } from '@/app/localization';
import { objectToTableData } from '@/app/utils';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/types/Transaction').TransactionConfirmationDialogSection} TransactionConfirmationDialogSection */

/**
 * Return type for useSendTransaction hook.
 * @typedef {object} UseSendTransactionReturnType
 * @property {() => Promise<TransactionBundle>} createTransaction - Creates a transfer transaction bundle.
 * @property {(transactionBundle: TransactionBundle) => TransactionConfirmationDialogSection[]} getConfirmationPreview
 *   - Generates confirmation sections for the transaction confirmation dialog.
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
	 * Creates a transfer transaction bundle.
	 * @returns {Promise<TransactionBundle>}
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
	 * Generates confirmation sections for the transaction confirmation dialog.
	 * @param {TransactionBundle} transactionBundle - The transaction bundle to preview.
	 * @returns {TransactionConfirmationDialogSection[]}
	 */
	const getConfirmationPreview = transactionBundle => {
		const { chainName, networkIdentifier, modules: { addressBook }, accounts } = walletController;
		const walletAccounts = accounts;

		const createHashLockTableData = transaction => {
			const hashLockData = {
				type: transaction.type,
				description: $t('form_transfer_hash_lock_description', {
					lockedAmount: transaction.lockedAmount,
					duration: transaction.duration
				}),
				fee: transaction.fee
			};

			return objectToTableData(hashLockData);
		};

		const createTransferTableData = transaction => {
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

		return transactionBundle.transactions.map((transaction, index) => {
			let tableData;

			if (SymbolTransactionType.HASH_LOCK === transaction.type)
				tableData = createHashLockTableData(transaction);
			else
				tableData = createTransferTableData(transaction);

			return {
				id: `section_${index}`,
				title: '',
				chainName,
				networkIdentifier,
				addressBook,
				walletAccounts,
				tableData
			};
		});
	};

	return {
		createTransaction,
		getConfirmationPreview
	};
};
