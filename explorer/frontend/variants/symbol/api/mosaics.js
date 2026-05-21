import { createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

// Symbol mosaic flags bitmask
const FLAG_SUPPLY_MUTABLE = 1;
const FLAG_TRANSFERABLE = 2;
const FLAG_RESTRICTABLE = 4;
const FLAG_REVOKABLE = 8;
const MOSAIC_NAMESPACE_LOOKUP_ERROR_STATUSES = [400, 404, 409];

const formatRelativeMosaicSupply = (amount, divisibility = 0) => {
	const value = `${amount || 0}`;
	const isNegative = value.startsWith('-');
	const unsignedValue = isNegative ? value.substring(1) : value;
	const [integerValue] = unsignedValue.split('.');
	const normalizedDivisibility = Number(divisibility || 0);

	if (!normalizedDivisibility)
		return `${isNegative ? '-' : ''}${integerValue}`;

	const paddedValue = integerValue.padStart(normalizedDivisibility + 1, '0');
	const splitIndex = paddedValue.length - normalizedDivisibility;
	const wholePart = paddedValue.substring(0, splitIndex);
	const fractionalPart = paddedValue.substring(splitIndex);
	const relativeValue = `${wholePart}.${fractionalPart}`;

	return `${isNegative ? '-' : ''}${relativeValue}`;
};

const mosaicInfoFromDTO = (data, mosaicNames = {}) => {
	const mosaic = data.mosaic || {};
	const duration = Number(mosaic.duration || 0);
	const startHeight = Number(mosaic.startHeight || 0);
	const isUnlimitedDuration = duration === 0;
	const flags = mosaic.flags || 0;
	const divisibility = Number(mosaic.divisibility || 0);
	const supply = mosaic.supply || 0;

	return {
		id: mosaic.id,
		name: mosaic.id,
		creator: hexToSymbolAddress(mosaic.ownerAddress),
		aliasNames: mosaicNames[mosaic.id] || [],
		supply: Number(supply),
		initialSupply: Number(supply),
		value: formatRelativeMosaicSupply(supply, divisibility),
		divisibility,
		registrationHeight: startHeight,
		registrationTimestamp: null,
		isUnlimitedDuration,
		namespaceExpirationHeight: isUnlimitedDuration ? null : startHeight + duration,
		expirationHeight: isUnlimitedDuration ? 0 : startHeight + duration,
		namespaceRegistrationHeight: null,
		namespaceExpirationTimestamp: null,
		namespaceName: null,
		rootNamespaceName: null,
		description: null,
		isSupplyMutable: !!(flags & FLAG_SUPPLY_MUTABLE),
		isTransferable: !!(flags & FLAG_TRANSFERABLE),
		isRestrictable: !!(flags & FLAG_RESTRICTABLE),
		isRevokable: !!(flags & FLAG_REVOKABLE),
		levy: null
	};
};

const fetchMosaicNames = async mosaicIds => {
	const uniqueMosaicIds = [...new Set(mosaicIds)].filter(id => !!id);

	if (!uniqueMosaicIds.length)
		return {};

	try {
		const { mosaicNames = [] } = await fetchSymbolNode('namespaces/mosaic/names', {
			method: 'POST',
			body: JSON.stringify({
				mosaicIds: uniqueMosaicIds
			}),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		return Object.fromEntries(mosaicNames.map(item => [item.mosaicId, item.names || []]));
	} catch (error) {
		if (
			MOSAIC_NAMESPACE_LOOKUP_ERROR_STATUSES.includes(error.response?.status)
			|| MOSAIC_NAMESPACE_LOOKUP_ERROR_STATUSES.includes(error.response?.data?.status)
		)
			return {};

		throw error;
	}
};

export const fetchMosaicPage = async searchParams => {
	const url = createSymbolSearchURL('mosaics', searchParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const mosaicIds = (response.data || []).map(data => data.mosaic?.id);
	const mosaicNames = await fetchMosaicNames(mosaicIds);
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, data => mosaicInfoFromDTO(data, mosaicNames));
};

export const fetchMosaicInfo = createTryFetchInfoFunction(async id => {
	const data = await fetchSymbolNode(`mosaics/${id}`);

	return mosaicInfoFromDTO(data);
});
