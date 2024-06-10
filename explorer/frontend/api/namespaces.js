import config from '@/config';
import { createMosaicName } from '@/utils/format';
import { createFetchInfoFunction, createSearchURL, createPage, createSearchCriteria, makeRequest } from '@/utils/server';

export const fetchNamespaceInfo = createFetchInfoFunction(async id => {
	const namespace = await makeRequest(`${config.API_BASE_URL}/namespace/${id}`);

	return formatNamespace(namespace);
});

export const fetchNamespacePage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	const url = createSearchURL(`${config.API_BASE_URL}/namespaces`, searchCriteria);
	const namespaces = await makeRequest(url);

	return createPage(namespaces, searchCriteria.pageNumber, formatNamespace);
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
		isUnlimitedDuration: !data.expirationHeight,
		namespaceMosaics: Object.entries(namespaceMosaicsMap).map(([namespaceName, mosaics]) => ({
			namespaceId: namespaceName,
			namespaceName,
			data: mosaics
		}))
	};
};
