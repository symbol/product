// Resolved mosaic infos keyed by mosaic id string, as produced by MosaicService.fetchMosaicInfos.
// Used by the from-dto mapper to resolve non-native mosaic amounts and divisibility.
export const mosaicInfos = {
	'test.token': {
		id: 'test.token',
		name: 'test.token',
		divisibility: 2,
		supply: 10000,
		isSupplyMutable: false,
		isTransferable: true
	}
};
