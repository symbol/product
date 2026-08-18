import { fetchAccountInfo, fetchAccountInfoByPublicKey } from './accounts';
import { fetchBlockInfo } from './blocks';
import { fetchMosaicInfo } from './mosaics';
import { fetchNamespaceInfo } from './namespaces';
import { fetchTransactionInfo } from './transactions';

const ADDRESS_LENGTH = 40;
const HEX_KEY_LENGTH = 64;

const searchAccount = query => {
	if (ADDRESS_LENGTH === query.length)
		return fetchAccountInfo(query);

	if (HEX_KEY_LENGTH === query.length)
		return fetchAccountInfoByPublicKey(query);

	return null;
};

const searchNamespace = async query => {
	const namespace = await fetchNamespaceInfo(query.toLowerCase());

	if (namespace || 2 > query.split('.').length)
		return namespace;

	const rootNamespaceName = query.split('.')[0] || '';

	return fetchNamespaceInfo(rootNamespaceName.toLowerCase());
};

const searchHandlers = {
	block: query => fetchBlockInfo(query),
	transaction: query => (HEX_KEY_LENGTH === query.length ? fetchTransactionInfo(query) : null),
	account: searchAccount,
	mosaic: query => fetchMosaicInfo(query.toLowerCase()),
	namespace: searchNamespace
};

/**
 * Searches for the entity matching the text.
 * @param {string} text - search text
 * @param {string} [type] - entity type to search for; every type is searched when omitted
 * @returns {Promise<object>} map of the entities found, keyed by type
 */
export const search = async (text, type) => {
	const query = `${text}`.trim().toUpperCase();
	const requestedTypes = type ? [type] : Object.keys(searchHandlers);
	const types = requestedTypes.filter(requestedType => searchHandlers[requestedType]);
	const entities = await Promise.all(types.map(searchType => searchHandlers[searchType](query)));
	const results = {};

	types.forEach((searchType, index) => {
		if (entities[index])
			results[searchType] = entities[index];
	});

	return results;
};
