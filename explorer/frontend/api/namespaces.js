import config from '@/config';
import { createAPICallFunction, createAPISearchURL, createMosaicName, createPage, createSearchCriteria, makeRequest } from '@/utils';

export const fetchNamespaceInfo = createAPICallFunction(async id => {
	const namespace = await makeRequest(`${config.API_BASE_URL}/namespace/${id}`);

	return formatNamespace(namespace);
});

export const fetchNamespacePage = async searchCriteria => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);
	const url = createAPISearchURL(`${config.API_BASE_URL}/namespaces`, { pageNumber, pageSize });
	const namespaces = await makeRequest(url);

	return createPage(namespaces, pageNumber, formatNamespace);
};

const formatNamespace = data => {
	const namespaceMosaicsMap = {};
	data.mosaics.forEach(item => {
		if (!namespaceMosaicsMap[item.namespaceName]) namespaceMosaicsMap[item.namespaceName] = [];
		namespaceMosaicsMap[item.namespaceName].push({
			id: createMosaicName(item.namespaceName, item.mosaicName),
			name: createMosaicName(item.namespaceName, item.mosaicName),
			registrationHeight: item.registeredHeight,
			registrationTimestamp: item.registeredTimestamp,
			supply: item.totalSupply
		});
	});

	return {
		name: data.rootNamespace,
		id: data.rootNamespace,
		creator: data.owner,
		subNamespaceCount: data.subNamespaces.length,
		subNamespaces: data.subNamespaces,
		registrationTimestamp: data.registeredTimestamp,
		registrationHeight: data.registeredHeight,
		expirationHeight: data.expirationHeight,
		namespaceMosaics: Object.entries(namespaceMosaicsMap).map(([namespaceName, mosaics]) => ({
			namespaceId: namespaceName,
			namespaceName,
			data: mosaics
		}))
	};
};
