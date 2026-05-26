import { createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';

export const METADATA_TYPE = {
	MOSAIC: 1,
	NAMESPACE: 2
};

export const hexToUtf8 = value => {
	if (!value || !/^(?:[0-9A-Fa-f]{2})+$/.test(value))
		return '';

	const bytes = new Uint8Array(value.match(/.{2}/g).map(byte => parseInt(byte, 16)));

	return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
};

const metadataEntryFromDTO = data => {
	const metadataEntry = data.metadataEntry || {};

	return {
		scopedMetadataKey: metadataEntry.scopedMetadataKey?.toUpperCase() || null,
		senderAddress: hexToSymbolAddress(metadataEntry.sourceAddress),
		targetAddress: hexToSymbolAddress(metadataEntry.targetAddress),
		value: hexToUtf8(metadataEntry.value)
	};
};

export const fetchMetadataPage = async searchParams => {
	const metadataSearchParams = {
		...searchParams,
		pageSize: 10
	};
	const url = createSymbolSearchURL('metadata', metadataSearchParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, metadataEntryFromDTO);
};
