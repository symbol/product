import { SymbolTransactionType } from '@/app/constants';
import { $t } from '@/app/localization';
import { objectToTableData } from '@/app/utils';

/** @typedef {import('@/app/types/Account').AccountInfo} AccountInfo */
/** @typedef {import('@/app/types/Account').PrivateAccount} PrivateAccount */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/screens/multisig/types/Multisig').Cosignatory} Cosignatory */
/** @typedef {import('@/app/types/Transaction').TransactionConfirmationDialogSection} TransactionConfirmationDialogSection */


/**
 * Return type for useMultisigTransaction hook.
 * @typedef {object} UseMultisigTransactionReturnType
 * @property {() => Promise<TransactionBundle>} createNewAccountTransaction - Creates a transaction for a new multisig account.
 * @property {() => Promise<TransactionBundle>} createModificationTransaction
 *   - Creates a transaction for modifying an existing multisig account.
 * @property {(transactionBundle: TransactionBundle) => TransactionConfirmationDialogSection[]} getConfirmationPreview
 *   - Generates confirmation sections for the transaction confirmation dialog.
 */

/**
 * React hook for creating multisig account modification transactions and generating preview data.
 * @param {object} params - Hook parameters.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {PrivateAccount|null} [params.multisigAccount] - The generated multisig account.
 * @param {AccountInfo|null} [params.multisigAccountInfo] - Existing multisig account info.
 * @param {Cosignatory[]} params.cosignatories - List of cosignatory addresses.
 * @param {number} params.minApproval - Minimum approvals required for transactions.
 * @param {number} params.minRemoval - Minimum approvals required for cosignatory removal.
 * @returns {UseMultisigTransactionReturnType}
 */
export const useMultisigTransaction = ({
	walletController,
	multisigAccount,
	multisigAccountInfo,
	cosignatories,
	minApproval,
	minRemoval
}) => {
	/**
	 * Creates a multisig account modification transaction.
	 * @returns {Promise<TransactionBundle>}
	 */
	const createNewAccountTransaction = async () => {
		if (!multisigAccount)
			throw new Error('Multisig account not generated');

		const generatedAccountInfo = {
			cosignatories: [],
			minApproval: 0,
			minRemoval: 0
		};
		const updatedValues = {
			cosignatories,
			minApproval,
			minRemoval
		};
		const deltas = walletController.modules.multisig.calculateDeltas({
			multisigAccountInfo: generatedAccountInfo,
			updatedValues
		});

		const tx = walletController.modules.multisig.createTransaction({
			...deltas,
			multisigAccount
		});

		return tx;
	};

	const createModificationTransaction = async () => {
		if (!multisigAccountInfo)
			throw new Error('Multisig account info not available');

		const updatedValues = {
			cosignatories,
			minApproval,
			minRemoval
		};
		const deltas = walletController.modules.multisig.calculateDeltas({
			multisigAccountInfo,
			updatedValues
		});

		const tx = walletController.modules.multisig.createTransaction({
			...deltas,
			multisigAccount: multisigAccountInfo
		});

		return tx;
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

		const createMultisigModificationTableData = transaction => {
			const multisigModificationTransaction = transaction.innerTransactions[0];

			const previewData = {
				type: transaction.type,
				transactionInitiator: transaction.signerAddress,
				multisigAddress: multisigModificationTransaction.signerAddress
			};

			if (multisigModificationTransaction.addressAdditions.length)
				previewData.cosignatoryAdditions = multisigModificationTransaction.addressAdditions;

			if (multisigModificationTransaction.addressDeletions.length)
				previewData.cosignatoryDeletions = multisigModificationTransaction.addressDeletions;

			if (multisigModificationTransaction.minApprovalDelta !== 0)
				previewData.minApprovalDelta = multisigModificationTransaction.minApprovalDelta;

			if (multisigModificationTransaction.minRemovalDelta !== 0)
				previewData.minRemovalDelta = multisigModificationTransaction.minRemovalDelta;

			previewData.fee = transaction.fee;

			return objectToTableData(previewData);
		};

		return transactionBundle.transactions.map((transaction, index) => {
			let tableData;

			if (SymbolTransactionType.HASH_LOCK === transaction.type)
				tableData = createHashLockTableData(transaction);
			else
				tableData = createMultisigModificationTableData(transaction);

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
		createNewAccountTransaction,
		createModificationTransaction,
		getConfirmationPreview
	};
};
