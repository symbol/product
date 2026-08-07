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
 * @param {string} params.mosaicId - The mosaic id to revoke.
 * @param {number} params.divisibility - The mosaic divisibility.
 * @param {string} params.amount - The amount to revoke in relative units.
 * @param {string} params.sourceAddress - The holder address to revoke the mosaic from.
 * @returns {UseRevokeMosaicTransactionReturnType}
 */
export const useRevokeMosaicTransaction = ({
	walletController,
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
		const transactionBundle = walletController.modules.mosaic.createRevocationTransaction({
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

		const createRevocationTableData = transaction => {
			const previewData = {
				type: transaction.type,
				signerAddress: transaction.signerAddress,
				sourceAddress: transaction.sourceAddress,
				mosaicId: transaction.mosaic.id,
				amount: transaction.mosaic.amount,
				fee: transaction.fee
			};

			return objectToTableData(previewData);
		};

		return transactionBundle.transactions.map((transaction, index) => {
			const tableData = createRevocationTableData(transaction);

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
