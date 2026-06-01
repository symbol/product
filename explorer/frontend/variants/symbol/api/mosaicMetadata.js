import { METADATA_TYPE, fetchMetadataPage } from './metadata';

export const fetchMosaicMetadataPage = async searchParams => fetchMetadataPage({
	...searchParams,
	metadataType: METADATA_TYPE.MOSAIC
});
