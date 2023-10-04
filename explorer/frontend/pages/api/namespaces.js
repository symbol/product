import { formatMosaic } from './mosaics';
import config from '@/config';
import { createAPICallFunction, createAPISearchURL, createMosaicName, createPage, createSearchCriteria } from '@/utils';

export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return;
	}

	const data = await getNamespacePage(req.query);

	res.status(200).json(data);
}

export const fetchNamespacePage = async searchCriteria => {
	const params = new URLSearchParams(searchCriteria).toString();
	const response = await fetch(`/api/namespaces?${params}`);

	return response.json();
};

export const getNamespaceInfo = createAPICallFunction(async id => {
	const response = await fetch(`${config.API_BASE_URL}/namespace/${id}`);
	const namespace = await response.json();

	return formatNamespace(namespace);
});

export const getNamespacePage = async searchCriteria => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);
	const url = createAPISearchURL(`${config.API_BASE_URL}/namespaces`, { pageNumber, pageSize });
	const response = await fetch(url);
	const namespaces = await response.json();

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
