import { stubAccounts, stubHarvestedBlocks } from './fixtures';
import { stubPage, stubValue } from './stub';
import {
	createApiUrl,
	createPage,
	createSearchCriteria,
	createSearchURL,
	makeRequest
} from '@/app/utils/server';

const ACCOUNT_LIST_SORT_FIELDS = new Set(['ID', 'IMPORTANCE', 'BALANCE', 'HEIGHT']);
const ACCOUNT_LIST_MOSAIC_ID_PATTERN = /^[0-9A-Fa-f]{16}$/;
const ACCOUNT_LIST_SEARCH_PARAMETERS = new Set([
	'isLatest', 'isActiveHarvesting', 'mosaic', 'sort_field', 'sort_order', 'mosaic_id', 'is_harvesting'
]);

/**
 * Fetches one page of Symbol accounts from Explorer REST.
 * @param {object} [searchParams] - page and supported account search parameters
 * @returns {Promise<{data: Array, pageNumber: number}>} account page
 */
export const fetchAccountPage = async searchParams => {
	for (const parameter of ['pageNumber', 'pageSize']) {
		const value = searchParams?.[parameter];
		if (undefined !== value && (
			('number' !== typeof value && ('string' !== typeof value || !value.length || /[^0-9]/.test(value))) ||
			!Number.isSafeInteger(Number(value))
		))
			throw new Error(`${parameter} must be a safe integer or decimal digit string`);
	}

	const searchCriteria = createSearchCriteria(searchParams);
	const { pageNumber, pageSize, filter } = searchCriteria;
	if (pageNumber < 1)
		throw new Error('pageNumber must be a positive integer');

	if (pageSize < 1 || 100 < pageSize)
		throw new Error('pageSize must be between 1 and 100');

	const offset = pageSize * (pageNumber - 1);
	if (!Number.isSafeInteger(offset) || 100000 < offset)
		throw new Error('Account page offset must be between 0 and 100000');

	const unknownParameter = Object.keys(filter).find(parameter => !ACCOUNT_LIST_SEARCH_PARAMETERS.has(parameter));
	if (unknownParameter)
		throw new Error(`Unsupported Symbol account search parameter: ${unknownParameter}`);

	if (undefined !== filter.isLatest && 'boolean' !== typeof filter.isLatest)
		throw new Error('isLatest must be a boolean');

	if (undefined !== filter.isActiveHarvesting && 'boolean' !== typeof filter.isActiveHarvesting)
		throw new Error('isActiveHarvesting must be a boolean');

	const isLatest = filter.isLatest === true;
	const isActiveHarvesting = filter.isActiveHarvesting === true;
	if (undefined !== filter.is_harvesting &&
		'boolean' !== typeof filter.is_harvesting &&
		('string' !== typeof filter.is_harvesting || !/^(true|false)$/i.test(filter.is_harvesting)))
		throw new Error('is_harvesting must be true or false');

	const requestedSortField = filter.sort_field;
	if (undefined !== requestedSortField && 'string' !== typeof requestedSortField)
		throw new Error('sort_field must be ID, IMPORTANCE, BALANCE, or HEIGHT');

	const sortField = undefined === requestedSortField ? undefined : requestedSortField.toUpperCase();
	if (undefined !== sortField && !ACCOUNT_LIST_SORT_FIELDS.has(sortField))
		throw new Error('sort_field must be ID, IMPORTANCE, BALANCE, or HEIGHT');

	const requestedSortOrder = filter.sort_order;
	if (undefined !== requestedSortOrder &&
		('string' !== typeof requestedSortOrder || 'DESC' !== requestedSortOrder.toUpperCase()))
		throw new Error('sort_order must be DESC');

	if (undefined !== filter.mosaic && undefined !== filter.mosaic_id)
		throw new Error('mosaic and mosaic_id cannot both be specified');

	const mosaicId = undefined !== filter.mosaic ? filter.mosaic : filter.mosaic_id;
	if (undefined !== mosaicId && ('string' !== typeof mosaicId || !ACCOUNT_LIST_MOSAIC_ID_PATTERN.test(mosaicId)))
		throw new Error('mosaic_id must be a 16-character hexadecimal string');

	if (undefined !== filter.mosaic_id && 'BALANCE' !== sortField)
		throw new Error('mosaic_id requires BALANCE sorting');

	if (isLatest && undefined !== sortField && 'HEIGHT' !== sortField)
		throw new Error('isLatest conflicts with sort_field');

	if (isLatest && undefined !== mosaicId)
		throw new Error('isLatest conflicts with mosaic balance sorting');

	if (undefined !== mosaicId && undefined !== sortField && 'BALANCE' !== sortField)
		throw new Error('mosaic requires BALANCE sorting');

	const resolvedSortField = isLatest ? 'HEIGHT' : undefined !== mosaicId ? 'BALANCE' : sortField;
	if ('BALANCE' === resolvedSortField && undefined === mosaicId)
		throw new Error('mosaic_id is required for BALANCE sorting');

	const explicitHarvesting = undefined === filter.is_harvesting
		? undefined
		: 'string' === typeof filter.is_harvesting ? 'true' === filter.is_harvesting.toLowerCase() : filter.is_harvesting;
	if (isActiveHarvesting && false === explicitHarvesting)
		throw new Error('isActiveHarvesting conflicts with is_harvesting=false');

	const restFilter = {};
	if (undefined !== resolvedSortField)
		restFilter.sort_field = resolvedSortField;

	if (undefined !== requestedSortOrder)
		restFilter.sort_order = requestedSortOrder.toUpperCase();

	if (undefined !== mosaicId)
		restFilter.mosaic_id = mosaicId;

	if (isActiveHarvesting || undefined !== explicitHarvesting)
		restFilter.is_harvesting = isActiveHarvesting || explicitHarvesting;

	const restSearchCriteria = { ...searchCriteria, filter: restFilter };
	const url = createSearchURL(createApiUrl('accounts'), restSearchCriteria);
	const accounts = await makeRequest(url);

	return createPage(accounts, pageNumber, accountListInfoFromDTO);
};

/**
 * Maps one Symbol Account list DTO to the fields used by existing account lists.
 * @param {object} data - Symbol Account list DTO
 * @returns {object} mapped account list row
 */
const accountListInfoFromDTO = data => ({
	address: data.address,
	publicKey: data.publicKey,
	accountType: data.accountType,
	importance: data.importance * 100,
	balance: data.balance,
	namespaces: data.namespaces,
	mosaics: data.mosaics,
	description: data.description,
	isHarvestingActive: data.isHarvestingActive,
	isMultisig: data.isMultisig
});

export const fetchAccountInfo = stubValue(stubAccounts[0]);
export const fetchAccountInfoByPublicKey = stubValue(stubAccounts[0]);
export const fetchAccountHarvestedBlockPage = stubPage(stubHarvestedBlocks);
