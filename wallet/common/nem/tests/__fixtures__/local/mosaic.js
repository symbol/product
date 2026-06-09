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

// The normalized mosaics owned by an account, as resolved by mosaicListFromDTO (and
// MosaicService.fetchAccountMosaics) from the owned mosaic DTOs: the native currency seeded from the
// network currency, test.token resolved from its definition, and an unresolved mosaic with no info.
export const accountMosaics = [
	{ 
		id: 'nem.xem', 
		name: 'XEM', 
		divisibility: 6, 
		amount: '1.5' 
	},
	{ 
		...mosaicInfos['test.token'], 
		amount: '2.5' 
	},
	{ 
		id: 'unknown.mosaic', 
		name: 'unknown.mosaic', 
		amount: null, 
		absoluteAmount: 999, 
		divisibility: null 
	}
];
