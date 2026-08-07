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
 * @param {string} params.mosaicId - The mosaic id to modify.
 * @param {number} params.divisibility - The mosaic divisibility.
 * @param {string} params.delta - The supply change magnitude in relative units.
 * @param {number} params.action - The supply change action.
 * @returns {UseModifyMosaicTransactionReturnType}
 */
export const useModifyMosaicTransaction = ({
	walletController,
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
		const transactionBundle = walletController.modules.mosaic.createSupplyChangeTransaction({
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

		const createSupplyChangeTableData = transaction => {
			const previewData = {
				type: transaction.type,
				signerAddress: transaction.signerAddress,
				mosaicId: transaction.mosaicId,
				action: transaction.action,
				// The bundle carries the delta in absolute units, the dialog shows the amount the user entered
				delta: absoluteToRelativeAmount(transaction.delta, divisibility),
				fee: transaction.fee
			};

			return objectToTableData(previewData);
		};

		return transactionBundle.transactions.map((transaction, index) => {
			const tableData = createSupplyChangeTableData(transaction);

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
