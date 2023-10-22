import { fetchAccountInfo, fetchAccountInfoByPublicKey } from './accounts';
import { fetchBlockInfo } from './blocks';
import { fetchMosaicInfo } from './mosaics';
import { fetchNamespaceInfo } from './namespaces';
import { fetchTransactionInfo } from './transactions';

export const search = async text => {
	const query = `${text}`.trim().toUpperCase();
	const results = {};
	let account;
	let transaction;
	let namespace;

	const block = await fetchBlockInfo(query);
	if (query.length === 64) transaction = await fetchTransactionInfo(query);
	if (query.length === 40) account = await fetchAccountInfo(query);
	if (!account && query.length === 64) account = await fetchAccountInfoByPublicKey(query);
	const mosaic = await fetchMosaicInfo(query.toLowerCase());
	namespace = await fetchNamespaceInfo(query.toLowerCase());
	if (!namespace && query.split('.').length > 1) {
		const mosaicRootNamespaceName = query.split('.')[0] || '';
		namespace = await fetchNamespaceInfo(mosaicRootNamespaceName.toLowerCase());
	}

	if (block) results.block = block;
	if (transaction) results.transaction = transaction;
	if (account) results.account = account;
	if (mosaic) results.mosaic = mosaic;
	if (namespace) results.namespace = namespace;

	return results;
};
