import { $t } from '@/app/localization';

/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */

/**
 * Alert data for cosignatory input feedback.
 * @typedef {object} CosignatoryInputAlertData
 * @property {boolean} isVisible - Whether the alert should be visible.
 * @property {string} text - The alert message text.
 * @property {import('@/app/types/ColorVariants').SemanticRoleColorVariants} variant - The alert variant.
 */
/**
 * Creates alert data for cosignatory input feedback.
 * @param {string[]} cosignatories - The list of cosignatory addresses.
 * @param {WalletAccount} currentAccount - The current account object.
 * @returns {CosignatoryInputAlertData} The alert data.
 */
export const createCosignatoryInputAlertData = (cosignatories, currentAccount) => {
	if (cosignatories.includes(currentAccount.address)) {
		return {
			isVisible: false
		};
	}

	return {
		isVisible: true,
		text: $t('s_multisig_cosignatoryAlert_currentAccount_text'),
		variant: 'warning'
	};
};
