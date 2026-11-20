import { FilterType } from '@/app/types/Filter';

/** @typedef {import('@/contract/types/Config').AssetsScreenConfig} AssetsScreenConfig */

/** @type {AssetsScreenConfig} */
export const assetsScreenConfig = {
	filters: [
		{
			name: 'expired',
			titleKey: 'screen_assets_chip_expired',
			type: FilterType.BOOLEAN
		},
		{
			name: 'created',
			titleKey: 'screen_assets_chip_created',
			type: FilterType.BOOLEAN
		}
	]
};
