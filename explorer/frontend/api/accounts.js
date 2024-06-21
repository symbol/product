import config from '@/config';
import { createFetchInfoFunction, createSearchURL, createPage, createSearchCriteria, makeRequest } from '@/utils/server';

/**
 * @typedef Page
 * @property {Array} data - the page data, an array of objects
 * @property {number} pageNumber The page number
 */

/**
 * Fetches the account page.
 * @param {object} searchParams - search parameters
 * @returns {Promise<Page>} account page
 */
export const fetchAccountPage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	let url;

	if (searchCriteria.filter.mosaic) {
		searchCriteria.filter = { namespaceName: searchCriteria.filter.mosaic };
		url = createSearchURL(`${config.API_BASE_URL}/mosaic/rich/list`, searchCriteria);
	} else {
		url = createSearchURL(`${config.API_BASE_URL}/accounts`, searchCriteria);
	}
	const accounts = await makeRequest(url);

	return createPage(accounts, searchCriteria.pageNumber, accountInfoFromDTO);
};

/**
 * Fetches the account info.
 * @param {String} address - requested account address
 * @returns {Promise<Object>} account info
 */
export const fetchAccountInfo = createFetchInfoFunction(async address => {
	const accountInfo = await makeRequest(`${config.API_BASE_URL}/account?address=${address}`);

	return accountInfoFromDTO(accountInfo);
});

/**
 * Fetches the account info by public key.
 * @param {String} publicKey - requested account public key
 * @returns {Promise<Object>} account info
 */
export const fetchAccountInfoByPublicKey = createFetchInfoFunction(async publicKey => {
	const accountInfo = await makeRequest(`${config.API_BASE_URL}/account?publicKey=${publicKey}`);

	return accountInfoFromDTO(accountInfo);
});

/**
 * Maps the account info from the DTO.
 * @param {object} data - raw data from response
 * @returns {object} mapped account info
 */
const accountInfoFromDTO = data => ({
	remoteAddress: data.remoteAddress || null,
	address: data.address,
	publicKey: data.publicKey || null,
	description: data.remarks || null,
	balance: data.balance,
	vestedBalance: data.vestedBalance || null,
	mosaics:
		data.mosaics?.map(item => ({
			name: item.namespace_name,
			id: item.namespace_name,
			amount: item.quantity
		})) || [],
	importance: data.importance ? +data.importance * 100 : null,
	harvestedBlocks: data.harvestedBlocks || null,
	harvestedFees: data.harvestedFees || null,
	height: data.height || null,
	minCosignatories: data.minCosignatories || 0,
	cosignatoryOf: data.cosignatoryOf || [],
	cosignatories: data.cosignatories || [],
	isMultisig: data.cosignatories?.length > 0,
	isHarvestingActive: data.harvestRemoteStatus === 'ACTIVE'
});
