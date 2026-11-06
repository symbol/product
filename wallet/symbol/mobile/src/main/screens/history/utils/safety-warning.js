import { TransactionKind } from '@/app/constants';
import { getTransactionTypeInfo } from '@/app/lib/transaction';
import { $t } from '@/app/localization';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
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
 * @param {ChainName} chainName - Chain the transaction belongs to.
 * @returns {boolean} True if transaction could be dangerous.
 */
export const isTransactionDangerous = (transaction, chainName) => {
	const hasLoseAccessRisk = type => Boolean(getTransactionTypeInfo(type, chainName).hasLoseAccessRisk);

	if (hasLoseAccessRisk(transaction.type))
		return true;

	if (getTransactionTypeInfo(transaction.type, chainName).kind !== TransactionKind.AGGREGATE)
		return false;

	return transaction.innerTransactions.some(innerTransaction => hasLoseAccessRisk(innerTransaction.type));
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
		text: $t('screen_history_alert_safetyWarning_description'),
		variant: 'warning'
	};
};
