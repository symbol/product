import { createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

const namespaceInfoFromDTO = data => {
	const namespace = data.namespace || {};
	const startHeight = Number(namespace.startHeight || 0);
	const endHeight = Number(namespace.endHeight || 0);
	const isRoot = namespace.registrationType === 0;

	// Resolve the most specific namespace ID for this entry
	const namespaceId = namespace[`level${namespace.depth - 1}`] || namespace.level0;

	return {
		name: namespaceId,
		id: namespaceId,
		creator: hexToSymbolAddress(namespace.ownerAddress),
		registrationHeight: startHeight,
		expirationHeight: endHeight || null,
		isUnlimitedDuration: false,
		subNamespaceCount: isRoot ? 0 : null,
		subNamespaces: [],
		namespaceMosaics: []
	};
};

export const fetchNamespacePage = async searchParams => {
	const url = createSymbolSearchURL('namespaces', searchParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, namespaceInfoFromDTO);
};

export const fetchNamespaceInfo = createTryFetchInfoFunction(async id => {
	const data = await fetchSymbolNode(`namespaces/${id}`);

	return namespaceInfoFromDTO(data);
});
