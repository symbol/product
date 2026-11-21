export const transferUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 176,
	timestamp: null,
	toAddress: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
	transactionHash: '0101010101010101010101010101010101010101010101010101010101010101',
	transactionType: 'TRANSFER',
	value: [
		{
			message: {
				payload: '48656C6C6F',
				type: 0
			}
		},
		{
			amount: 123.0,
			id: '72C0212E67A08BCE',
			name: '72C0212E67A08BCE'
		}
	],
	version: 1
};

export const aggregateBondedUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: [
		{
			deadline: null,
			embeddedTransactions: null,
			fee: null,
			fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
			height: 0,
			signature: null,
			size: null,
			timestamp: null,
			toAddress: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
			transactionHash: null,
			transactionType: 'TRANSFER',
			value: [
				{
					amount: 5.0,
					id: '72C0212E67A08BCE',
					name: '72C0212E67A08BCE'
				}
			],
			version: 1
		}
	],
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 264,
	timestamp: null,
	toAddress: null,
	transactionHash: '0202020202020202020202020202020202020202020202020202020202020202',
	transactionType: 'AGGREGATE_BONDED',
	value: [
		{
			cosignatures: [],
			transactionsHash: '2C03591ED233B317D8617565D7F75085E0710804EB836933171DDEBC3BBC4294'
		}
	],
	version: 2
};
