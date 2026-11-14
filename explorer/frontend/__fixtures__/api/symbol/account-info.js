// Contract-based Symbol Account detail DTO examples; these are not live API captures.
export const accountInfoResponse = {
	address: 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
	publicKey: '01'.repeat(32),
	description: null,
	namespaces: ['zeta', 'alpha'],
	balance: 1.234567,
	importance: 0.025,
	accountType: 'unlinked',
	isHarvestingActive: null,
	mosaics: [
		{ id: '1234567890ABCDEF', name: '1234567890ABCDEF', amount: 12345, isCreatedByAccount: false },
		{ id: '72C0212E67A08BCE', name: 'xym', amount: 1.234567, isCreatedByAccount: true }
	],
	supplementalKeys: { linked: null, node: null, vrf: null },
	votingKeys: [],
	importanceHistory: [],
	isMultisig: false,
	cosignatories: [],
	cosignatoryOf: [],
	height: 123,
	harvestedBlocks: null,
	harvestedFees: null,
	minCosignatories: 0,
	minRemoval: null,
	remoteAddress: null
};

export const accountInfoWithoutPublicKeyResponse = {
	...accountInfoResponse,
	publicKey: null,
	accountType: null,
	balance: 0,
	importance: 0,
	mosaics: [],
	supplementalKeys: { linked: null, node: null, vrf: null },
	height: null
};

export const mainAccountInfoResponse = {
	...accountInfoResponse,
	accountType: 'main',
	supplementalKeys: { linked: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI', node: null, vrf: null }
};

export const remoteAccountInfoResponse = {
	...accountInfoResponse,
	address: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
	publicKey: '02'.repeat(32),
	accountType: 'remote',
	balance: 0,
	mosaics: [],
	supplementalKeys: { linked: accountInfoResponse.address, node: null, vrf: null }
};

export const multisigAccountInfoResponse = {
	...accountInfoResponse,
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
