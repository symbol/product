import { $t } from '@/app/localization';
import { TransactionGroup } from '@/app/types/Transaction';

/** @typedef {import('@/app/types/ColorVariants').SemanticRoleColorVariants} SemanticRoleColorVariants */

/**
 * Transaction status display data.
 * @typedef {object} TransactionStatusDisplayData
 * @property {SemanticRoleColorVariants} variant - Semantic color variant for styling.
 * @property {string} iconName - Icon name for the status indicator.
 * @property {string} text - Localized status text.
 */

/**
 * Gets transaction status display data based on the transaction group.
 * @param {string} group - Transaction group from TransactionGroup enum.
 * @returns {TransactionStatusDisplayData} Status display data.
 */
export const getTransactionStatus = group => {
	const statusMap = {
		[TransactionGroup.UNCONFIRMED]: {
			variant: 'warning',
			iconName: 'pending',
			text: $t('transactionStatus_unconfirmed')
		},
		[TransactionGroup.PARTIAL]: {
			variant: 'info',
			iconName: 'sign',
			text: $t('transactionStatus_partial')
		},
		[TransactionGroup.CONFIRMED]: {
			variant: 'success',
			iconName: 'check-circle',
			text: $t('transactionStatus_confirmed')
		},
		[TransactionGroup.FAILED]: {
			variant: 'danger',
			iconName: 'alert-danger',
			text: $t('transactionStatus_failed')
		}
	};
    
	return statusMap[group];
};
