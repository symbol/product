import { getAccountInfo } from './accounts';
import { getBlockInfo } from './blocks';
import { getMosaicInfo } from './mosaic';
import { getTransactionInfo } from './transactions';
import { searchStub } from '../../stubs/search';

export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return;
	}

	const data = await search(req.query.q);

	res.status(200).json(data);
}

export const fetchSearch = async q => {
	const params = new URLSearchParams({ q }).toString();
	const response = await fetch(`/search?${params}`);

	return response.json();
};

export const search = async query => {
	const results = {};

	const block = await getBlockInfo(query);
	const transaction = await getTransactionInfo(query);
	const account = await getAccountInfo(query);
	const mosaic = await getMosaicInfo(query);

	if (block) results.block = block;
	if (transaction) results.transaction = transaction;
	if (account) results.mosaic = account;
	if (mosaic) results.mosaic = mosaic;

	return results;
};
