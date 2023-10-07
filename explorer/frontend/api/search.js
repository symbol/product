import { fetchAccountInfo } from './accounts';
import { fetchBlockInfo } from './blocks';
import { fetchMosaicInfo } from './mosaics';
import { fetchNamespaceInfo } from './namespaces';
import { fetchTransactionInfo } from './transactions';

export const search = async text => {
	const query = `${text}`.trim();
	const results = {};
	let transaction;
	let namespace;

	const block = await fetchBlockInfo(query);
	if (query.length === 64) transaction = await fetchTransactionInfo(query.toUpperCase());
	const account = await fetchAccountInfo(query.toUpperCase());
	const mosaic = await fetchMosaicInfo(query.toLowerCase());
	namespace = await fetchNamespaceInfo(query.toLowerCase());
	if (!namespace && query.split('.').length > 1) namespace = await fetchNamespaceInfo(query.split('.')[0]);

	if (block) results.block = block;
	if (transaction) results.transaction = transaction;
	// if (account) results.account = account;
	if (mosaic) results.mosaic = mosaic;
	if (namespace) results.namespace = namespace;

	return results;
};
