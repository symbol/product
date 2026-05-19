import { createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

// Symbol mosaic flags bitmask
const FLAG_SUPPLY_MUTABLE = 1;
const FLAG_TRANSFERABLE = 2;

const mosaicInfoFromDTO = data => {
	const mosaic = data.mosaic || {};
	const duration = Number(mosaic.duration || 0);
	const startHeight = Number(mosaic.startHeight || 0);
	const isUnlimitedDuration = duration === 0;
	const flags = mosaic.flags || 0;

	return {
		id: mosaic.id,
		name: mosaic.id,
		creator: hexToSymbolAddress(mosaic.ownerAddress),
		supply: Number(mosaic.supply || 0),
		initialSupply: Number(mosaic.supply || 0),
		divisibility: mosaic.divisibility || 0,
		registrationHeight: startHeight,
		registrationTimestamp: null,
		isUnlimitedDuration,
		namespaceExpirationHeight: isUnlimitedDuration ? null : startHeight + duration,
		namespaceRegistrationHeight: null,
		namespaceExpirationTimestamp: null,
		namespaceName: null,
		rootNamespaceName: null,
		description: null,
		isSupplyMutable: !!(flags & FLAG_SUPPLY_MUTABLE),
		isTransferable: !!(flags & FLAG_TRANSFERABLE),
		levy: null
	};
};

export const fetchMosaicPage = async searchParams => {
	const url = createSymbolSearchURL('mosaics', searchParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, mosaicInfoFromDTO);
};

export const fetchMosaicInfo = createTryFetchInfoFunction(async id => {
	const data = await fetchSymbolNode(`mosaics/${id}`);

	return mosaicInfoFromDTO(data);
});
