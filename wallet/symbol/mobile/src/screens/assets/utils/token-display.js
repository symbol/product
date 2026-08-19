import { $t } from '@/app/localization';
import { SemanticRoleColorVariant } from '@/app/types/ColorVariants';
import { isTokenExpired } from '@/app/utils';

/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('@/app/screens/assets/types/Assets').TokenExpirationDisplayData} TokenExpirationDisplayData */

/**
 * Calculates token expiration status and alert data.
 * @param {Token} token - Token to check expiration for.
 * @param {NetworkProperties} networkProperties - Network properties with chain height.
 * @returns {TokenExpirationDisplayData} Token expiration data.
 */
export const getExpirationData = (token, networkProperties) => {
	const isExpirationSectionShown = Boolean(networkProperties && token?.endHeight && !token?.isUnlimitedDuration);
	const isExpired = isExpirationSectionShown && isTokenExpired(token, networkProperties.chainHeight);
	const isAlertVisible = isExpirationSectionShown;

	const alertVariant = isExpired
		? SemanticRoleColorVariant.DANGER
		: SemanticRoleColorVariant.WARNING;

	const alertText = isExpired
		? $t('s_assetDetails_alert_expired_description')
		: $t('s_assetDetails_alert_expirable_description');

	return {
		isTokenExpired: isExpired,
		isExpirationSectionShown,
		isAlertVisible,
		alertVariant,
		alertText
	};
};
