import { $t } from '@/app/localization';
import { FilterType } from '@/app/types/Filter';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('@/app/types/Filter').FilterItem} FilterItem */
/** @typedef {import('@/app/types/Filter').FilterValue} FilterValue */
/** @typedef {import('@/app/screens/assets/types/Assets').AssetSection} AssetSection */

/**
 * Returns the filter configuration for the assets screen.
 * @returns {FilterItem[]} Filter configuration array
 */
export const getAssetsFilterConfig = () => [
	{
		name: 'expired',
		title: $t('s_assets_filter_expired'),
		type: FilterType.BOOLEAN
	},
	{
		name: 'created',
		title: $t('s_assets_filter_created'),
		type: FilterType.BOOLEAN
	}
];

/**
 * Creates an asset section from chain data.
 * @param {string} chainName - Chain name identifier
 * @param {string} address - Account address
 * @param {Token[]} assets - Array of tokens
 * @returns {AssetSection} Asset section object
 */
const createSection = (chainName, address, assets) => ({
	title: address,
	chainName,
	address,
	data: assets
});

/**
 * Filters assets based on filter criteria.
 * @param {Token[]} assets - Array of tokens to filter
 * @param {FilterValue} filter - Active filter values
 * @param {WalletAccount} currentAccount - Current account
 * @param {NetworkProperties} networkProperties - Network properties with chain height
 * @returns {Token[]} Filtered array of tokens
 */
const filterAssets = (assets, filter, currentAccount, networkProperties) => {
	const filteredByCreated = filter.created
		? assets.filter(asset => asset.creator === currentAccount.address)
		: assets;

	if (filter.expired)
		return filteredByCreated;

	const filteredByExpired = filteredByCreated.filter(asset => asset.endHeight
		? !asset.endHeight || asset.isUnlimitedDuration || asset.endHeight > networkProperties.chainHeight
		: true);

	return filteredByExpired;
};

/**
 * Builds sections array from token data.
 * @param {Object} params - Parameters object
 * @param {FilterValue} params.filter - Current filter values
 * @param {WalletController[]} params.walletControllers - Array of wallet controllers to extract accounts and assets from
 * @returns {AssetSection[]} Sections array for SectionList
 */
export const buildAssetsSections = ({
	filter,
	walletControllers
}) => {
	const sections = [];
	const controllersWithAccounts = walletControllers.filter(controller => controller.currentAccount);

	controllersWithAccounts.forEach(controller => {
		const { currentAccount, currentAccountInfo, chainName, networkProperties } = controller;

		const assets = currentAccountInfo?.tokens ?? currentAccountInfo?.mosaics ?? [];
		const filteredAssets = filterAssets(assets, filter, currentAccount, networkProperties);

		if (filteredAssets.length === 0)
			return;
		
		sections.push(createSection(
			chainName,
			currentAccount.address,
			filteredAssets
		));
	});

	return sections;
};

