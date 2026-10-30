export const accountInfo = {
	linkedAddress: null,
	mainAddress: null,
	address: 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
	publicKey: '01'.repeat(32),
	description: null,
	balance: 1.234567,
	vestedBalance: null,
	mosaics: [
		{ name: '1234567890ABCDEF', id: '1234567890ABCDEF', amount: 12345, isCreatedByAccount: false },
		{ name: 'xym', id: '72C0212E67A08BCE', amount: 1.234567, isCreatedByAccount: true }
	],
	importance: 2.5,
	harvestedBlocks: null,
	harvestedFees: null,
	height: 123,
	minCosignatories: 0,
	cosignatoryOf: [],
	cosignatories: [],
	isMultisig: false,
	isHarvestingActive: null
};

export const accountInfoWithoutPublicKey = {
	...accountInfo,
	publicKey: null,
	balance: 0,
	mosaics: [],
	importance: 0,
	height: null
};

export const mainAccountInfo = {
	...accountInfo,
	linkedAddress: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'
};

export const remoteAccountInfo = {
	...accountInfo,
	linkedAddress: null,
	mainAddress: 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
	address: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
	publicKey: '02'.repeat(32),
	balance: 0,
	mosaics: []
};

export const multisigAccountInfo = {
	...accountInfo,
	balance: 0,
	mosaics: [],
	isMultisig: true,
	cosignatories: [
		'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
		'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY'
	],
	cosignatoryOf: ['TAHJNXEF62ZEVSOI3NP7YWODLCAMBNZCY6LTIIY'],
	minCosignatories: 2
};
