import { createSymbolNodePath, createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

const namespaceInfoFromDTO = data => {
	const namespace = data.namespace || {};
	const startHeight = Number(namespace.startHeight || 0);
	const endHeight = Number(namespace.endHeight || 0);
	const namespaceId = namespace[`level${namespace.depth - 1}`] || namespace.level0;

	return {
		name: namespaceId,
		id: namespaceId,
		creator: hexToSymbolAddress(namespace.ownerAddress),
		registrationHeight: startHeight,
		expirationHeight: endHeight || null,
		isUnlimitedDuration: false,
		subNamespaceCount: 0,
		subNamespaces: [],
		namespaceMosaics: []
	};
};

export const fetchNamespacePage = async searchParams => {
	const url = createSymbolSearchURL('namespaces', searchParams);
	const response = await fetchSymbolNode(createSymbolNodePath(url));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, namespaceInfoFromDTO);
};

export const fetchNamespaceInfo = createTryFetchInfoFunction(async id => {
	const namespace = await fetchSymbolNode(`namespaces/${id}`);

	return namespaceInfoFromDTO(namespace);
});
