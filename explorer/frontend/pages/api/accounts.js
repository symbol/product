import { getMarketData } from './stats';
import { getAccountInfoStub, getAccountsStub } from '../../stubs/accounts';
import { createPage, createSearchCriteria } from '@/utils';

export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return;
	}

	const data = await getAccountPage(req.query);

	res.status(200).json(data);
}

export const fetchAccountPage = async searchCriteria => {
	const params = new URLSearchParams(searchCriteria).toString();
	const response = await fetch(`/api/accounts?${params}`);

	return response.json();
};

export const getAccountPage = async (searchCriteria = {}) => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);
	const accounts = await getAccountsStub({ pageNumber, pageSize });

	return createPage(searchCriteria.isService ? [] : accounts, pageNumber);
};

export const getAccountInfo = async height => {
	const accountInfo = await getAccountInfoStub(height);

	return {
		remoteAddress: accountInfo.remoteAddress,
		address: accountInfo.address,
		publicKey: accountInfo.publicKey,
		description: accountInfo.remarkLabel,
		balance: accountInfo.balance,
		vestedBalance: accountInfo.vestedBalance,
		mosaics: accountInfo.mosaics,
		importance: accountInfo.importance,
		harvestedBlocks: accountInfo.harvestedBlocks,
		harvestedFees: accountInfo.harvestedFees,
		height: accountInfo.createdHeight,
		minCosignatories: accountInfo.minCosignatories,
		cosignatoryOf: accountInfo.cosignatoryOf,
		cosignatories: accountInfo.cosignatories,
		isMultisig: accountInfo.cosignatories.length > 0,
		isHarvestingActive: accountInfo.harvestRemoteStatus === 'active'
	};
};
