import { $t } from '@/app/localization';
import { FilterType } from '@/app/types/Filter';

/**
 * Returns the filter configuration for the assets screen.
 * @returns {Array} Filter configuration array
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

const createSection = (chainName, address, assets) => ({
	title: address,
	chainName,
	address,
	data: assets
});

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
 * @param {object} params - Parameters object
 * @param {object} params.filter - Current filter values
 * @param {import('wallet-common-core').WalletController[]} params.walletControllers
 * - Array of wallet controllers to extract accounts and assets from
 * @returns {Array} Sections array for SectionList
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

