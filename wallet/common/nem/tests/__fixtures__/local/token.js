import { accounts } from './wallet';

const { alice } = accounts;

// Resolved token infos keyed by token id string, as produced by TokenService.fetchTokenInfos.
// Used by the from-dto mapper to resolve non-native mosaic amounts and divisibility.
export const tokenInfos = {
	'test.token': {
		id: 'test.token',
		name: 'test.token',
		divisibility: 2,
		creator: alice.address,
		supply: 10000,
		isSupplyMutable: false,
		isTransferable: true
	},
	'makoto.metals.silver': {
		id: 'makoto.metals.silver',
		name: 'makoto.metals.silver',
		divisibility: 2,
		creator: alice.address,
		supply: 10000,
		isSupplyMutable: false,
		isTransferable: true
	},
	'test.mutable': {
		id: 'test.mutable',
		name: 'test.mutable',
		divisibility: 2,
		creator: alice.address,
		supply: 15000,
		isSupplyMutable: true,
		isTransferable: true
	}
};

// The normalized tokens owned by an account, as resolved by tokenListFromDTO (and
// TokenService.fetchAccountTokens) from the owned mosaic DTOs: the native currency seeded from the
// network currency, test.token resolved from its definition, and an unresolved token with no info.
export const accountTokens = [
	{ 
		id: 'nem.xem', 
		name: 'XEM', 
		divisibility: 6, 
		amount: '1.5' 
	},
	{ 
		...tokenInfos['test.token'], 
		amount: '2.5' 
	},
	{
		id: 'unknown.mosaic',
		name: 'unknown.mosaic',
		amount: null,
		absoluteAmount: '999'
	}
];
