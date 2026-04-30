import { $t } from '@/app/localization';
import { SemanticRoleColorVariant } from '@/app/types/ColorVariants';
import { getTokenKnownInfo } from '@/app/utils';

/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/screens/assets/types/Assets').ResolvedTokenData} ResolvedTokenData */
/** @typedef {import('@/app/screens/assets/types/Assets').TokenExpirationDisplayData} TokenExpirationDisplayData */

/**
 * Calculates token expiration status and alert data.
 * @param {Token} token - Token to check expiration for.
 * @param {NetworkProperties} networkProperties - Network properties with chain height.
 * @returns {TokenExpirationDisplayData} Token expiration data.
 */
export const getExpirationData = (token, networkProperties) => {
	const isExpirationSectionShown = Boolean(networkProperties && token?.endHeight && !token?.isUnlimitedDuration);
	const isTokenExpired = isExpirationSectionShown && token.endHeight <= networkProperties.chainHeight;
	const isAlertVisible = isExpirationSectionShown;

	const alertVariant = isTokenExpired 
		? SemanticRoleColorVariant.DANGER 
		: SemanticRoleColorVariant.WARNING;

	const alertText = isTokenExpired
		? $t('s_assetDetails_alert_expired_description')
		: $t('s_assetDetails_alert_expirable_description');

	return {
		isTokenExpired,
		isExpirationSectionShown,
		isAlertVisible,
		alertVariant,
		alertText
	};
};

/**
 * Resolves token display information from known tokens registry.
 * @param {Token} token - Token to get display info for.
 * @param {ChainName} chainName - Chain name identifier.
 * @param {NetworkIdentifier} networkIdentifier - Network identifier (mainnet/testnet).
 * @returns {ResolvedTokenData} Token display information.
 */
export const getTokenDisplayInfo = (token, chainName, networkIdentifier) => {
	const tokenKnownInfo = getTokenKnownInfo(
		chainName,
		networkIdentifier,
		token.id
	);

	const name = tokenKnownInfo.name ?? token.name ?? token.id;
	const { ticker, imageId } = tokenKnownInfo;
	const nameText = !ticker
		? name
		: `${name} • ${ticker}`;

	return {
		name: nameText,
		ticker,
		imageId
	};
};
