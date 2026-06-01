import { METADATA_TYPE, fetchMetadataPage } from './metadata';

const metadataFilterMap = {
	isAccount: METADATA_TYPE.ACCOUNT,
	isMosaic: METADATA_TYPE.MOSAIC,
	isNamespace: METADATA_TYPE.NAMESPACE
};

export const fetchAccountMetadataPage = async searchParams => {
	const metadataSearchParams = { ...searchParams };

	delete metadataSearchParams.isLatest;
	Object.entries(metadataFilterMap).forEach(([filterName, metadataType]) => {
		if (metadataSearchParams[filterName])
			metadataSearchParams.metadataType = metadataType;

		delete metadataSearchParams[filterName];
	});

	return fetchMetadataPage(metadataSearchParams);
};
