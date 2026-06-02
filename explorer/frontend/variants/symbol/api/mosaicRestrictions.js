import { createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';

const MOSAIC_GLOBAL_RESTRICTION_TYPE = 1;
const MOSAIC_ADDRESS_RESTRICTION_TYPE = 0;
const SELF_REFERENCE_MOSAIC_ID = '0000000000000000';

export const restrictionTypeLabels = {
	0: 'No Restriction',
	1: 'Equal',
	2: 'Not Equal',
	3: 'Less Than',
	4: 'Less Than Or Equal',
	5: 'Greater Than',
	6: 'Greater Than Or Equal'
};

const getEntryTypeText = entryType =>
	Number(entryType) === MOSAIC_GLOBAL_RESTRICTION_TYPE
		? 'Mosaic Global Restriction'
		: 'Mosaic Address Restriction';

const formatGlobalRestriction = (item, mosaicId) => {
	const referenceMosaicId = item.restriction?.referenceMosaicId === SELF_REFERENCE_MOSAIC_ID
		? mosaicId
		: item.restriction?.referenceMosaicId;
	const restrictionType = item.restriction?.restrictionType;
	const restrictionTypeLabel = restrictionTypeLabels[restrictionType] || restrictionType;

	return `${referenceMosaicId} Key ${item.key} ${restrictionTypeLabel} ${item.restriction?.restrictionValue}`;
};

const formatAddressRestriction = item => `${item.key}: ${item.value}`;

const mosaicRestrictionFromDTO = data => {
	const entry = data.mosaicRestrictionEntry || {};
	const entryType = Number(entry.entryType);
	const isGlobalRestriction = entryType === MOSAIC_GLOBAL_RESTRICTION_TYPE;

	return {
		compositeHash: entry.compositeHash,
		entryType: getEntryTypeText(entryType),
		mosaicId: entry.mosaicId,
		targetAddress: isGlobalRestriction ? null : hexToSymbolAddress(entry.targetAddress),
		restrictions: (entry.restrictions || [])
			.map(item => (isGlobalRestriction ? formatGlobalRestriction(item, entry.mosaicId) : formatAddressRestriction(item)))
			.join(', ')
	};
};

export const fetchMosaicRestrictionPage = async searchParams => {
	const { mosaicId, type, ...restParams } = searchParams || {};
	const entryType = Number(type);
	const url = createSymbolSearchURL('restrictions/mosaic', {
		...restParams,
		...(mosaicId !== undefined ? { mosaicId } : {}),
		type
	});
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const filteredResponse = {
		...response,
		data: (response.data || []).filter(item => Number(item.mosaicRestrictionEntry?.entryType) === entryType)
	};
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(filteredResponse, pageNumber, mosaicRestrictionFromDTO);
};

export { MOSAIC_ADDRESS_RESTRICTION_TYPE, MOSAIC_GLOBAL_RESTRICTION_TYPE };
