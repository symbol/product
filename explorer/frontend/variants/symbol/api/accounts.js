import { stubAccounts } from './fixtures';
import { stubPage } from './stub';
import { REWARD_TYPE } from '@/app/constants';
import {
	createApiUrl,
	createPage,
	createSearchCriteria,
	createSearchURL,
	createTryFetchInfoFunction,
	makeRequest
} from '@/app/utils/server';

export const fetchAccountPage = stubPage(stubAccounts);

/**
 * Fetches the account info by address.
 * @param {string} address - requested account address
 * @returns {Promise<object|null>} account info or null when the account is not found
 */
export const fetchAccountInfo = createTryFetchInfoFunction(async address => {
	const accountInfo = await makeRequest(createApiUrl(`account?address=${address}`));

	return accountInfoFromDTO(accountInfo);
});

/**
 * Fetches the account info by public key.
 * @param {string} publicKey - requested account public key
 * @returns {Promise<object|null>} account info or null when the account is not found
 */
export const fetchAccountInfoByPublicKey = createTryFetchInfoFunction(async publicKey => {
	const accountInfo = await makeRequest(createApiUrl(`account?publicKey=${publicKey}`));

	return accountInfoFromDTO(accountInfo);
});

/**
 * Fetches harvest-fee receipts paid to the requested account, one row per receipt.
 * REST already applies native mosaic divisibility; block details supply only timestamps.
 * @param {object} searchParams - account address and pagination parameters.
 * @returns {Promise<object>} harvested receipt page.
 */
export const fetchAccountHarvestedBlockPage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	searchCriteria.filter = {
		targetAddress: searchCriteria.filter.address,
		receiptType: 8515,
		group: 'balanceChange'
	};
	const receipts = await makeRequest(createSearchURL(createApiUrl('receipts'), searchCriteria));
	const heights = [...new Set(receipts.map(receipt => receipt.height))];
	const blocks = await Promise.all(heights.map(height => makeRequest(createApiUrl(`block/${height}`))));
	const timestamps = new Map(blocks.map(block => [block.height, block.timestamp]));
	const page = createPage(receipts, searchCriteria.pageNumber, receipt => ({
		height: receipt.height,
		timestamp: timestamps.get(receipt.height),
		type: REWARD_TYPE.HARVESTING,
		amount: receipt.mosaics.find(mosaic => mosaic.isNative).amount
	}));

	return { ...page, isLastPage: receipts.length < searchCriteria.pageSize };
};

/**
 * Maps the Symbol account detail DTO to the account page model.
 * @param {object} data - raw data from the Explorer REST response
 * @returns {object} mapped account info
 */
const accountInfoFromDTO = data => {
	const isRemoteAccount = 'remote' === data.accountType;
	const linkedAddress = data.supplementalKeys.linked;
	const [importanceSignificand, importanceExponent = '0'] = data.importance.toString().split('e');

	return {
		// The linked key identifies the opposite role: main -> remote, remote -> main.
		linkedAddress: isRemoteAccount ? null : linkedAddress,
		mainAddress: isRemoteAccount ? linkedAddress : null,
		address: data.address,
		publicKey: data.publicKey,
		description: data.description,
		balance: data.balance,
		// Symbol account detail REST does not expose vestedBalance.
		vestedBalance: null,
		mosaics: data.mosaics.map(item => ({
			name: item.name,
			id: item.id,
			amount: item.amount,
			isCreatedByAccount: item.isCreatedByAccount
		})),
		// Shift the decimal exponent to avoid binary floating-point multiplication error.
		importance: Number(`${importanceSignificand}e${Number(importanceExponent) + 2}`),
		harvestedBlocks: data.harvestedBlocks,
		harvestedFees: data.harvestedFees,
		height: data.height,
		minCosignatories: data.minCosignatories,
		cosignatoryOf: data.cosignatoryOf,
		cosignatories: data.cosignatories,
		isMultisig: data.isMultisig,
		isHarvestingActive: data.isHarvestingActive
	};
};
