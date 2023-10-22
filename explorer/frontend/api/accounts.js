import config from '@/config';
import { createAPICallFunction, createAPISearchURL, createPage, createSearchCriteria, makeRequest } from '@/utils';

export const fetchAccountPage = async (searchCriteria = {}) => {
	const { pageNumber, pageSize, filter } = createSearchCriteria(searchCriteria);
	const url = createAPISearchURL(`${config.API_BASE_URL}/accounts`, { pageNumber, pageSize }, filter);
	const accounts = await makeRequest(url);

	return createPage(accounts, pageNumber, formatAccount);
};

export const fetchAccountInfo = createAPICallFunction(async address => {
	const accountInfo = await makeRequest(`${config.API_BASE_URL}/account?address=${address}`);

	return formatAccount(accountInfo);
});

export const fetchAccountInfoByPublicKey = createAPICallFunction(async publicKey => {
	const accountInfo = await makeRequest(`${config.API_BASE_URL}/account?publicKey=${publicKey}`);

	return formatAccount(accountInfo);
});

const formatAccount = data => ({
	remoteAddress: data.remoteAddress || null,
	address: data.address,
	publicKey: data.publicKey,
	description: data.remarks,
	balance: data.balance,
	vestedBalance: data.vestedBalance || null,
	mosaics: data.mosaics.map(item => ({
		name: item.namespace_name,
		id: item.namespace_name,
		amount: item.quantity
	})),
	importance: +data.importance * 100,
	harvestedBlocks: data.harvestedBlocks,
	harvestedFees: data.harvestedFees,
	height: data.height,
	minCosignatories: data.minCosignatories || 0,
	cosignatoryOf: data.cosignatoryOf || [],
	cosignatories: data.cosignatories || [],
	isMultisig: data.cosignatories?.length > 0,
	isHarvestingActive: data.harvestRemoteStatus === 'ACTIVE'
});
