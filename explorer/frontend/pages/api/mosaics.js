import config from '@/config';
import { createAPICallFunction, createAPISearchURL, createMosaicName, createPage, createSearchCriteria, getRootNamespaceName } from '@/utils';

export const getMosaicInfo = createAPICallFunction(async id => {
	const mosaicResponse = await fetch(`${config.API_BASE_URL}/mosaic/${id}`);
	const mosaic = await mosaicResponse.json();

	return formatMosaic(mosaic);
});

export const getMosaicPage = async searchCriteria => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);
	const url = createAPISearchURL(`${config.API_BASE_URL}/mosaics`, { pageNumber, pageSize });
	const response = await fetch(url);
	const mosaics = await response.json();

	return createPage(mosaics, pageNumber, formatMosaic);
};

export const formatMosaic = data => ({
	id: createMosaicName(data.namespaceName, data.mosaicName),
	name: createMosaicName(data.namespaceName, data.mosaicName),
	namespaceName: data.namespaceName,
	rootNamespaceName: getRootNamespaceName(data.namespaceName),
	creator: data.creator,
	description: data.description,
	divisibility: data.divisibility,
	initialSupply: data.initialSupply,
	supply: data.totalSupply,
	registrationHeight: data.registeredHeight,
	registrationTimestamp: data.registeredTimestamp,
	namespaceRegistrationHeight: data.rootNamespaceRegisteredHeight,
	namespaceExpirationHeight: data.rootNamespaceExpirationHeight,
	namespaceExpirationTimestamp: data.rootNamespaceRegisteredTimestamp,
	isSupplyMutable: data.supplyMutable,
	isTransferable: data.transferable,
	levy: data.levyFee ? {
		fee: data.levyFee,
		mosaic: data.levyNamespace,
		recipient: data.levyRecipient,
		type: data.levyType,
	} : null,
});
