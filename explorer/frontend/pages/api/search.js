import { getAccountInfo } from './accounts';
import { getBlockInfo } from './blocks';
import { getMosaicInfo } from './mosaics';
import { getNamespaceInfo } from './namespaces';
import { getTransactionInfo } from './transactions';

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

export const search = async text => {
	const query = `${text}`.trim();
	const results = {};
	let transaction;
	let namespace;

	const block = await getBlockInfo(query);
	if (query.length === 64) transaction = await getTransactionInfo(query.toUpperCase());
	const account = await getAccountInfo(query.toUpperCase());
	const mosaic = await getMosaicInfo(query.toLowerCase());
	namespace = await getNamespaceInfo(query.toLowerCase());
	if (!namespace && query.split('.').length > 1) namespace = await getNamespaceInfo(query.split('.')[0]);

	if (block) results.block = block;
	// if (transaction) results.transaction = transaction;
	// if (account) results.account = account;
	if (mosaic) results.mosaic = mosaic;
	if (namespace) results.namespace = namespace;

	return results;
};
