import { stubAccounts, stubHarvestedBlocks } from './fixtures';
import { stubPage, stubValue } from './stub';
import { createApiUrl, createPage, createSearchCriteria, createSearchURL, makeRequest } from '@/app/utils/server';

/**
 * Fetches one page of Symbol accounts from Explorer REST.
 * @param {object} [searchParams] - page and supported account search parameters
 * @returns {Promise<{data: Array, pageNumber: number}>} account page
 */
export const fetchAccountPage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	const { filter } = searchCriteria;

	if (filter.isLatest)
		filter.sort_field = 'HEIGHT';
	delete filter.isLatest;

	if (filter.isActiveHarvesting)
		filter.is_harvesting = true;
	delete filter.isActiveHarvesting;

	if (undefined !== filter.mosaic) {
		filter.sort_field = 'BALANCE';
		filter.mosaic_id = filter.mosaic;
		delete filter.mosaic;
	}

	const url = createSearchURL(createApiUrl('accounts'), searchCriteria);
	const accounts = await makeRequest(url);

	return createPage(accounts, searchCriteria.pageNumber, accountListInfoFromDTO);
};

const ratioToPercentage = ratio => {
	const [significand, exponent = 0] = ratio.toString().split('e');
	return Number(`${significand}e${Number(exponent) + 2}`);
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
	importance: ratioToPercentage(data.importance),
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
