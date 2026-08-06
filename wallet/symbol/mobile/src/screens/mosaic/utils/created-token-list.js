import { $t } from '@/app/localization';
import { FilterType } from '@/app/types/Filter';
import { isTokenExpired } from '@/app/utils';

/** @typedef {import('@/app/types/Filter').FilterItem} FilterItem */
/** @typedef {import('@/app/types/Filter').FilterValue} FilterValue */
/** @typedef {import('wallet-common-symbol/src/types/Mosaic').Mosaic} Mosaic */
/** @typedef {import('wallet-common-symbol/src/types/Mosaic').MosaicInfo} MosaicInfo */
/** @typedef {import('@/app/screens/mosaic/types/Mosaic').CreatedTokenSection} CreatedTokenSection */

// Group identifier of the single list section
const CREATED_TOKENS_GROUP = 'createdTokens';

/**
 * Returns the filter configuration for the created token list screen.
 * @returns {FilterItem[]} Filter configuration array.
 */
export const getCreatedTokenListFilterConfig = () => [
	{
		name: 'revokable',
		title: $t('s_createdTokenList_filter_revokable'),
		type: FilterType.BOOLEAN
	},
	{
		name: 'supplyMutable',
		title: $t('s_createdTokenList_filter_supplyMutable'),
		type: FilterType.BOOLEAN
	},
	{
		name: 'expired',
		title: $t('s_createdTokenList_filter_expired'),
		type: FilterType.BOOLEAN
	}
];

/**
 * Filters created tokens by the active filter values. Expired tokens are hidden by default;
 * the expired filter reveals them.
 * @param {Mosaic[]} tokens - The tokens to filter.
 * @param {FilterValue} filter - The active filter values.
 * @param {number} chainHeight - The current chain height used to determine expiration.
 * @returns {Mosaic[]} The filtered tokens.
 */
export const filterCreatedTokens = (tokens, filter, chainHeight) => {
	const filteredByRevokable = filter.revokable
		? tokens.filter(token => token.isRevokable)
		: tokens;

	const filteredBySupplyMutable = filter.supplyMutable
		? filteredByRevokable.filter(token => token.isSupplyMutable)
		: filteredByRevokable;

	if (filter.expired)
		return filteredBySupplyMutable;

	return filteredBySupplyMutable.filter(token => !isTokenExpired(token, chainHeight));
};

/**
 * Merges held token amounts into created token definitions. A matching held entry provides
 * the amount and name; definitions the account does not hold get a zero amount.
 * @param {MosaicInfo[]} mosaicInfos - The created token definitions.
 * @param {Mosaic[]} heldTokens - The tokens currently held by the account.
 * @returns {Mosaic[]} The tokens ready for display.
 */
export const mergeHeldAmounts = (mosaicInfos, heldTokens) => {
	const heldTokensById = new Map(heldTokens.map(token => [token.id, token]));

	return mosaicInfos.map(mosaicInfo => {
		const heldToken = heldTokensById.get(mosaicInfo.id);

		return {
			...mosaicInfo,
			amount: heldToken?.amount ?? '0',
			name: heldToken?.name ?? mosaicInfo.names?.[0] ?? mosaicInfo.id
		};
	});
};

/**
 * Builds the list sections for the created token list. Wraps the tokens into a single untitled
 * section; returns no sections when the list is empty so the template shows its empty placeholder.
 * @param {Mosaic[]} tokens - The tokens to wrap into a section.
 * @returns {CreatedTokenSection[]} The sections array.
 */
export const buildCreatedTokenListSections = tokens =>
	tokens.length === 0
		? []
		: [{ title: '', group: CREATED_TOKENS_GROUP, data: tokens }];
