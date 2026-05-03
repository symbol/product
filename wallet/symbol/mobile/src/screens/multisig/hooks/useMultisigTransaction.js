import { SymbolTransactionType } from '@/app/constants';
import { $t } from '@/app/localization';
import { objectToTableData } from '@/app/utils';

/** @typedef {import('@/app/types/Account').AccountInfo} AccountInfo */
/** @typedef {import('@/app/types/Account').PrivateAccount} PrivateAccount */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Table').TableData} TableData */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/screens/multisig/types/Multisig').Cosignatory} Cosignatory */


/**
 * Return type for useMultisigTransaction hook.
 * @typedef {object} UseMultisigTransactionReturnType
 * @property {() => Promise<Transaction>} createNewAccountTransaction - Creates a transaction for a new multisig account.
 * @property {() => Promise<Transaction>} createModificationTransaction
 *   - Creates a transaction for modifying an existing multisig account.
 * @property {(transaction: Transaction) => TableData} getTransactionPreviewTable
 *   - Generates preview table data for the confirmation dialog.
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
     * @returns {Promise<Transaction>}
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
     * Generates preview table data for the transaction confirmation dialog.
     * @param {Transaction} transaction - The transaction to preview.
     * @returns {TableData}
     */
	const getTransactionPreviewTable = transaction => {
		if (SymbolTransactionType.HASH_LOCK === transaction.type) {
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

	return {
		createNewAccountTransaction,
		createModificationTransaction,
		getTransactionPreviewTable
	};
};
