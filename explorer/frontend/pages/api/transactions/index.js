import { getTransactionsStub } from '../../../stubs/transactions';
import { createPage, createSearchCriteria } from '@/utils';

export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return;
	}

	const data = await getTransactionPage(req.query);

	res.status(200).json(data);
}

export const fetchTransactionPage = async searchCriteria => {
	const params = new URLSearchParams(searchCriteria).toString();
	const response = await fetch(`/api/transactions?${params}`);

	return response.json();
};

export const getTransactionPage = async (searchCriteria, group = 'confirmed') => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);
	const transactions = await getTransactionsStub({ pageNumber, pageSize }, group);

	return createPage(transactions, pageNumber);
};
