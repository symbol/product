import { SymbolTransactionType } from '@/app/constants';
import { $t } from '@/app/localization';
import { objectToTableData } from '@/app/utils';
import { absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Transaction').TransactionConfirmationDialogSection} TransactionConfirmationDialogSection */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Return type for useModifyMosaicTransaction hook.
 * @typedef {object} UseModifyMosaicTransactionReturnType
 * @property {() => Promise<TransactionBundle>} createModifyMosaicTransaction - Creates a supply change transaction bundle.
 * @property {(transactionBundle: TransactionBundle) => TransactionConfirmationDialogSection[]} getConfirmationPreview
 *   - Generates confirmation sections for the transaction confirmation dialog.
 */

/**
 * React hook for creating mosaic supply change transactions and generating preview data.
 * @param {object} params - Hook parameters.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {string} [params.senderPublicKey] - The creator public key. Defaults to the current account.
 * @param {string} params.mosaicId - The mosaic id to modify.
 * @param {number} params.divisibility - The mosaic divisibility.
 * @param {string} params.delta - The supply change magnitude in relative units.
 * @param {number} params.action - The supply change action.
 * @returns {UseModifyMosaicTransactionReturnType}
 */
export const useModifyMosaicTransaction = ({
	walletController,
	senderPublicKey,
	mosaicId,
	divisibility,
	delta,
	action
}) => {
	/**
	 * Creates a mosaic supply change transaction bundle.
	 * @returns {Promise<TransactionBundle>}
	 */
	const createModifyMosaicTransaction = async () => {
		const transactionBundle = walletController.modules.token.createSupplyChangeTransaction({
			senderPublicKey,
			mosaicId,
			divisibility,
			delta,
			action
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

		const createSupplyChangeTableData = transaction => {
			// For a multisig supply change the transaction is an aggregate wrapping the inner supply change
			const supplyChangeTransaction = transaction.innerTransactions
				? transaction.innerTransactions[0]
				: transaction;

			const previewData = {
				type: transaction.type,
				signerAddress: supplyChangeTransaction.signerAddress,
				mosaicId: supplyChangeTransaction.mosaicId,
				action: supplyChangeTransaction.action,
				// The bundle carries the delta in absolute units, the dialog shows the amount the user entered
				delta: absoluteToRelativeAmount(supplyChangeTransaction.delta, divisibility),
				fee: transaction.fee
			};

			return objectToTableData(previewData);
		};

		return transactionBundle.transactions.map((transaction, index) => {
			const tableData = SymbolTransactionType.HASH_LOCK === transaction.type
				? createHashLockTableData(transaction)
				: createSupplyChangeTableData(transaction);

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
		createModifyMosaicTransaction,
		getConfirmationPreview
	};
};
