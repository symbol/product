import { $t } from '@/app/localization';
import { MOSAIC_NEVER_EXPIRING_DURATION } from '@/app/screens/mosaic/constants';
import { objectToTableData } from '@/app/utils';
import { absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').MosaicFlags} MosaicFlags */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Transaction').TransactionConfirmationDialogSection} TransactionConfirmationDialogSection */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Return type for useMosaicTransaction hook.
 * @typedef {object} UseMosaicTransactionReturnType
 * @property {() => Promise<TransactionBundle>} createMosaicTransaction - Creates a mosaic creation transaction bundle.
 * @property {(transactionBundle: TransactionBundle) => TransactionConfirmationDialogSection[]} getConfirmationPreview
 *   - Generates confirmation sections for the transaction confirmation dialog.
 */

/**
 * React hook for creating mosaic transactions and generating preview data.
 * @param {object} params - Hook parameters.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {number} params.nonce - The mosaic nonce.
 * @param {string} params.supply - The mosaic initial supply in relative units.
 * @param {string} params.divisibility - The mosaic divisibility.
 * @param {string} params.duration - The mosaic duration in blocks.
 * @param {boolean} params.isNeverExpiring - Whether the mosaic never expires. Overrides the duration.
 * @param {MosaicFlags} params.flags - The mosaic flags values.
 * @returns {UseMosaicTransactionReturnType}
 */
export const useMosaicTransaction = ({
	walletController,
	nonce,
	supply,
	divisibility,
	duration,
	isNeverExpiring,
	flags
}) => {
	/**
	 * Creates a mosaic creation transaction bundle.
	 * @returns {Promise<TransactionBundle>}
	 */
	const createMosaicTransaction = async () => {
		const transactionBundle = walletController.modules.token.createTransaction({
			nonce,
			initialSupply: supply,
			divisibility: Number(divisibility),
			duration: isNeverExpiring ? MOSAIC_NEVER_EXPIRING_DURATION : Number(duration),
			isSupplyMutable: flags.isSupplyMutable,
			isTransferable: flags.isTransferable,
			isRestrictable: flags.isRestrictable,
			isRevokable: flags.isRevokable
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

		const createMosaicCreationTableData = transaction => {
			const [definitionTransaction, supplyChangeTransaction] = transaction.innerTransactions;
			const isExpiring = definitionTransaction.duration !== MOSAIC_NEVER_EXPIRING_DURATION;

			const previewData = {
				type: transaction.type,
				signerAddress: definitionTransaction.signerAddress,
				mosaicId: definitionTransaction.mosaicId,
				divisibility: definitionTransaction.divisibility,
				supply: absoluteToRelativeAmount(supplyChangeTransaction.delta, definitionTransaction.divisibility),
				duration: isExpiring ? definitionTransaction.duration : $t('data_unlimited'),
				isSupplyMutable: definitionTransaction.isSupplyMutable,
				isTransferable: definitionTransaction.isTransferable,
				isRestrictable: definitionTransaction.isRestrictable,
				isRevokable: definitionTransaction.isRevokable,
				fee: transaction.fee
			};

			return objectToTableData(previewData);
		};

		return transactionBundle.transactions.map((transaction, index) => {
			const tableData = createMosaicCreationTableData(transaction);

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
		createMosaicTransaction,
		getConfirmationPreview
	};
};
