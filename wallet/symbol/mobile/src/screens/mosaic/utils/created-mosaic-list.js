import { $t } from '@/app/localization';
import { FilterType } from '@/app/types/Filter';
import { isTokenExpired } from '@/app/utils';

/** @typedef {import('@/app/types/Filter').FilterItem} FilterItem */
/** @typedef {import('@/app/types/Filter').FilterValue} FilterValue */
/** @typedef {import('wallet-common-symbol/src/types/Mosaic').Mosaic} Mosaic */
/** @typedef {import('wallet-common-symbol/src/types/Mosaic').MosaicInfo} MosaicInfo */
/** @typedef {import('@/app/screens/mosaic/types/Mosaic').CreatedMosaicSection} CreatedMosaicSection */

// Group identifier of the single list section
const CREATED_MOSAICS_GROUP = 'createdMosaics';

/**
 * Returns the filter configuration for the created mosaic list screen.
 * @returns {FilterItem[]} Filter configuration array.
 */
export const getCreatedMosaicListFilterConfig = () => [
	{
		name: 'revokable',
		title: $t('s_createdMosaicList_filter_revokable'),
		type: FilterType.BOOLEAN
	},
	{
		name: 'supplyMutable',
		title: $t('s_createdMosaicList_filter_supplyMutable'),
		type: FilterType.BOOLEAN
	},
	{
		name: 'expired',
		title: $t('s_createdMosaicList_filter_expired'),
		type: FilterType.BOOLEAN
	}
];

/**
 * Filters created mosaics by the active filter values. Expired mosaics are hidden by default;
 * the expired filter reveals them.
 * @param {Mosaic[]} mosaics - The mosaics to filter.
 * @param {FilterValue} filter - The active filter values.
 * @param {number} chainHeight - The current chain height used to determine expiration.
 * @returns {Mosaic[]} The filtered mosaics.
 */
export const filterCreatedMosaics = (mosaics, filter, chainHeight) => {
	const filteredByRevokable = filter.revokable
		? mosaics.filter(mosaic => mosaic.isRevokable)
		: mosaics;

	const filteredBySupplyMutable = filter.supplyMutable
		? filteredByRevokable.filter(mosaic => mosaic.isSupplyMutable)
		: filteredByRevokable;

	if (filter.expired)
		return filteredBySupplyMutable;

	return filteredBySupplyMutable.filter(mosaic => !isTokenExpired(mosaic, chainHeight));
};

/**
 * Merges held mosaic amounts into created mosaic definitions. A matching held entry provides
 * the amount and name; definitions the account does not hold get a zero amount.
 * @param {MosaicInfo[]} mosaicInfos - The created mosaic definitions.
 * @param {Mosaic[]} heldMosaics - The mosaics currently held by the account.
 * @returns {Mosaic[]} The mosaics ready for display.
 */
export const mergeHeldAmounts = (mosaicInfos, heldMosaics) => {
	const heldMosaicsById = new Map(heldMosaics.map(mosaic => [mosaic.id, mosaic]));

	return mosaicInfos.map(mosaicInfo => {
		const heldMosaic = heldMosaicsById.get(mosaicInfo.id);

		return {
			...mosaicInfo,
			amount: heldMosaic?.amount ?? '0',
			name: heldMosaic?.name ?? mosaicInfo.names?.[0] ?? mosaicInfo.id
		};
	});
};

/**
 * Builds the list sections for the created mosaic list. Wraps the mosaics into a single untitled
 * section; returns no sections when the list is empty so the template shows its empty placeholder.
 * @param {Mosaic[]} mosaics - The mosaics to wrap into a section.
 * @returns {CreatedMosaicSection[]} The sections array.
 */
export const buildCreatedMosaicListSections = mosaics =>
	mosaics.length === 0
		? []
		: [{ title: '', group: CREATED_MOSAICS_GROUP, data: mosaics }];
