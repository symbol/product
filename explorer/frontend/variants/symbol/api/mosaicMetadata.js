import { fetchMetadataPage, METADATA_TYPE } from './metadata';

export const fetchMosaicMetadataPage = async searchParams => fetchMetadataPage({
	...searchParams,
	metadataType: METADATA_TYPE.MOSAIC
});
