import { $t } from '@/app/localization';
import { AggregateTypes, LoseAccessWarningTypes } from '@/app/screens/history/constants';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/ColorVariants').SemanticRoleColorVariants} SemanticRoleColorVariants */

/**
 * Safety warning alert display data.
 * @typedef {object} SafetyWarningAlertData
 * @property {boolean} isVisible - Whether the alert should be displayed.
 * @property {string} [text] - Alert message text.
 * @property {SemanticRoleColorVariants} [variant] - Semantic color variant for styling.
 */

/**
 * Checks if a transaction is potentially dangerous (could result in loss of access).
 * @param {Transaction} transaction - Transaction to check.
 * @returns {boolean} True if transaction could be dangerous.
 */
export const isTransactionDangerous = transaction => {
	if (LoseAccessWarningTypes.includes(transaction.type))
		return true;

	if (!AggregateTypes.includes(transaction.type))
		return false;

	return transaction.innerTransactions.some(innerTx => LoseAccessWarningTypes.includes(innerTx.type));
};

/**
 * Creates alert data for dangerous transaction warnings.
 * @param {boolean} isTransactionDangerous - Whether the transaction is dangerous.
 * @param {boolean} isCosignable - Whether the transaction can be cosigned.
 * @returns {SafetyWarningAlertData} Alert display data.
 */
export const createSafetyWarningAlertData = (isTransactionDangerous, isCosignable) => {
	if (!isTransactionDangerous || !isCosignable)
		return { isVisible: false };

	return {
		isVisible: true,
		text: $t('s_transactionDetails_safetyWarning_description'),
		variant: 'warning'
	};
};
