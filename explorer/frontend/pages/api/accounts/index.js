import { getAccountInfoStub, getAccountsStub } from '../../../stubs/accounts';
import { getMarketData } from '../stats';
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
	const marketData = await getMarketData();

	return {
		...accountInfo,
		balanceUSD: accountInfo.balance * marketData.price
	};
};
