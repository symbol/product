// Real NEM testnet accounts (public keys are lowercase, as NEM NIS returns them).
// Addresses are derived from the public keys via the NEM facade.
export const accounts = {
	alice: {
		address: 'TC47MC36TRAQ7ZRWHTY72H2B3AEKCLMLTFVNY3M4',
		publicKey: '76d6417552829b9423925fccb92144b7f4b2305bdba2a71490ac73a4b3377af3',
		networkIdentifier: 'testnet'
	},
	bob: {
		address: 'TC253ACKPWCLQLSERD5VJGOIWOLBFHYRDOX6KFW7',
		publicKey: '3d1801fa6b188bf589405a726dff0ee069a2534cbb68554e157601ed99d368a3',
		networkIdentifier: 'testnet'
	},
	carol: {
		address: 'TALICELCD3XPH4FFI5STGGNSNSWPOTG5E4DS2TOS',
		publicKey: 'a1aaca6c17a24252e674d155713cdf55996ad00175be4af02a20c67b59f9fe8a',
		networkIdentifier: 'testnet'
	}
};

export const currentAccount = accounts.alice;
