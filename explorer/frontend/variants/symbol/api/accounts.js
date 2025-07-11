import { createPage, createSearchCriteria, createTryFetchInfoFunction, makeRequest } from '@/utils/server';
import { addressFromRaw, createAPIURL, createSearchURL, getNetworkProperties } from '@/_variants/symbol/utils';
import { AccountService, MosaicService } from '@/_variants/symbol/api/services';
import config from '@/config';

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
	const pageUrl = createSearchURL(createAPIURL('accounts'), searchCriteria);
	const page = await makeRequest(pageUrl);

	return createPage(page.data, searchCriteria.pageNumber, accountInfoFromDTO);
};

/**
 * Fetches the account info.
 * @param {String} address - requested account address
 * @returns {Promise<Object>} account info
 */
export const fetchAccountInfo = createTryFetchInfoFunction(async address => {
	const accountInfo = await AccountService.fetchAccountInfo(getNetworkProperties(), address);
	let multisigInfo;
	
	try {
		multisigInfo = await AccountService.fetchMultisigInfo(getNetworkProperties(), address);
	}
	catch {}

	return {
		...accountInfo,
		isMultisig: Boolean(multisigInfo),
		cosignatoryOf: multisigInfo ? multisigInfo.multisigAddresses : [],
		cosignatories: multisigInfo ? multisigInfo.cosignatories : [],
		minApproval: multisigInfo ? multisigInfo.minApproval : 0,
		minRemoval: multisigInfo ? multisigInfo.minRemoval : 0
	};
});

/**
 * Fetches the account info by public key.
 * @param {String} publicKey - requested account public key
 * @returns {Promise<Object>} account info
 */
export const fetchAccountInfoByPublicKey = createTryFetchInfoFunction(async publicKey => {
	const accountInfo = await makeRequest(createAPIURL(`account?publicKey=${publicKey}`));

	return null;
});


/**
 * Maps the account info from the DTO.
 * @param {object} data - raw data from response
 * @returns {object} mapped account info
 */
const accountInfoFromDTO = data => {
	const { account } = data;

	return {
		address: addressFromRaw(account.address),
		publicKey: account.publicKey,
		// description: data.remarks || null,
		// balance: data.balance,
		mosaics: account.mosaics,
		importance: Number(account.importance),
		// harvestedBlocks: data.harvestedBlocks || null,
		// harvestedFees: data.harvestedFees || null,
		height: Number(account.publicKeyHeight),
		// minCosignatories: data.minCosignatories || 0,
		cosignatoryOf: data.cosignatoryOf || [],
		cosignatories: data.cosignatories || [],
		// isMultisig: data.cosignatories?.length > 0,
		// isHarvestingActive: data.harvestRemoteStatus === 'ACTIVE'
	};
};
