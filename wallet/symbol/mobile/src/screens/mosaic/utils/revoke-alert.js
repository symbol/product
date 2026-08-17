import { $t } from '@/app/localization';

/** @typedef {import('@/app/types/ColorVariants').SemanticRoleColorVariants} SemanticRoleColorVariants */

/**
 * No-holders alert display data.
 * @typedef {object} NoHoldersAlertData
 * @property {boolean} isVisible - Whether the alert should be displayed.
 * @property {string} [text] - Alert message text.
 * @property {SemanticRoleColorVariants} [variant] - Semantic color variant for styling.
 */

/**
 * Creates alert data for the revoke screen shown when no account other than the creator holds
 * the mosaic, since in that case there is nothing to revoke.
 * @param {number} holderCount - The number of holders the mosaic can be revoked from.
 * @param {boolean} isLoading - Whether the holders are still being fetched.
 * @returns {NoHoldersAlertData} Alert display data.
 */
export const createNoHoldersAlertData = (holderCount, isLoading) => {
	if (isLoading || holderCount > 0)
		return { isVisible: false };

	return {
		isVisible: true,
		text: $t('s_revoke_alert_noHolders_description'),
		variant: 'warning'
	};
};
