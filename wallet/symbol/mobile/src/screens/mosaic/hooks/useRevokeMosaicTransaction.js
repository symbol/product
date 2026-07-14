import { SymbolTransactionType } from '@/app/constants';
import { $t } from '@/app/localization';
import { objectToTableData } from '@/app/utils';

/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Transaction').TransactionConfirmationDialogSection} TransactionConfirmationDialogSection */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Return type for useRevokeMosaicTransaction hook.
 * @typedef {object} UseRevokeMosaicTransactionReturnType
 * @property {() => Promise<TransactionBundle>} createRevokeMosaicTransaction - Creates a mosaic revocation transaction bundle.
 * @property {(transactionBundle: TransactionBundle) => TransactionConfirmationDialogSection[]} getConfirmationPreview
 *   - Generates confirmation sections for the transaction confirmation dialog.
 */

/**
 * React hook for creating mosaic revocation transactions and generating preview data.
 * @param {object} params - Hook parameters.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {string} [params.senderPublicKey] - The creator public key. Defaults to the current account.
 * @param {string} params.mosaicId - The mosaic id to revoke.
 * @param {number} params.divisibility - The mosaic divisibility.
 * @param {string} params.amount - The amount to revoke in relative units.
 * @param {string} params.sourceAddress - The holder address to revoke the mosaic from.
 * @returns {UseRevokeMosaicTransactionReturnType}
 */
export const useRevokeMosaicTransaction = ({
	walletController,
	senderPublicKey,
	mosaicId,
	divisibility,
	amount,
	sourceAddress
}) => {
	/**
	 * Creates a mosaic revocation transaction bundle.
	 * @returns {Promise<TransactionBundle>}
	 */
	const createRevokeMosaicTransaction = async () => {
		const transactionBundle = walletController.modules.token.createRevocationTransaction({
			senderPublicKey,
			mosaicId,
			divisibility,
			amount,
			sourceAddress
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

		const createRevocationTableData = transaction => {
			// For a multisig revocation the transaction is an aggregate wrapping the inner revocation
			const revocationTransaction = transaction.innerTransactions
				? transaction.innerTransactions[0]
				: transaction;

			const previewData = {
				type: transaction.type,
				signerAddress: revocationTransaction.signerAddress,
				sourceAddress: revocationTransaction.sourceAddress,
				mosaicId: revocationTransaction.mosaic.id,
				amount: revocationTransaction.mosaic.amount,
				fee: transaction.fee
			};

			return objectToTableData(previewData);
		};

		return transactionBundle.transactions.map((transaction, index) => {
			const tableData = SymbolTransactionType.HASH_LOCK === transaction.type
				? createHashLockTableData(transaction)
				: createRevocationTableData(transaction);

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
		createRevokeMosaicTransaction,
		getConfirmationPreview
	};
};
