/* eslint-disable max-len */
export const transferUnconfirmedListItemResponse = {
	deadline: '2026-11-22 04:59:24',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	height: 0,
	signature: '75014F7352D8898D032FE5AF6088C454BE320C632520830AA15FC7330AF0B8921723195F32FCF110632B12810CBDE61A6C7314A0F113DBB620CA8A171CD4C200',
	size: 185,
	timestamp: null,
	toAddress: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
	transactionHash: '4BE56A3185E7748434C33D96F54EB0B1867FA5365797B32038D96CE2D065FB86',
	transactionType: 'TRANSFER',
	value: [
		{
			message: {
				payload: '526566756E642D32',
				type: 0
			}
		},
		{
			amount: 100,
			id: '4EB0A0590FF41C2D',
			name: '4EB0A0590FF41C2D'
		},
		{
			amount: 20.601464,
			id: '72C0212E67A08BCE',
			name: '72C0212E67A08BCE'
		}
	],
	version: 1
};

export const hashLockUnconfirmedListItemResponse = {
	deadline: '2026-11-24 15:30:02',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	height: 0,
	signature: 'F93F567A9D49168EC9F2C4E7540B42079C1AD6122A8CC534638B01D6B511E33F2917B650E27292032120E815C793957E69F3B293EFA60E24930EF24D4392BC02',
	size: 184,
	timestamp: null,
	toAddress: null,
	transactionHash: '6D2A21E0D436A84F3374A4E6D4ADC4879B5FAF0E480ABBC5EBBA3604EC1B9C6D',
	transactionType: 'HASH_LOCK',
	value: [
		{
			amount: '10000000',
			duration: '480',
			hash: 'A3007DC5119C73CBB55B92002C8B0A7E621ED31A131B9EDFDE89AA93A4C21DCF',
			mosaicId: '72C0212E67A08BCE'
		}
	],
	version: 1
};

export const aggregateCompleteUnconfirmedListItemResponse = {
	deadline: '2026-11-25 10:19:13',
	embeddedTransactions: [
		{
			deadline: null,
			embeddedTransactions: null,
			fee: null,
			fromAddress: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
			height: 0,
			signature: null,
			size: null,
			timestamp: null,
			toAddress: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
			transactionHash: null,
			transactionType: 'TRANSFER',
			value: [
				{
					amount: 1,
					id: '406FE5941F06BCBE',
					name: '406FE5941F06BCBE'
				}
			],
			version: 1
		}
	],
	fee: null,
	fromAddress: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	height: 0,
	signature: '28B9F5721EBE980D700CD78B4E52677E7A150843D0AE19FB7485B940834C043410F6525AEF059E049CD5FFD6C3FBE092F7284B0CAF8EA95F27E0BEF893093B00',
	size: 384,
	timestamp: null,
	toAddress: null,
	transactionHash: 'DFF89FB0B71EFEF6B2F08677FE2F29C8E93C808DA13093B66909C3B30E9F829C',
	transactionType: 'AGGREGATE_COMPLETE',
	value: [
		{
			cosignatures: [],
			transactionsHash: '8D2F29E52EB55537792C1D2FF4515FB5787DD179A4CE0C9E0C362293409B98D3'
		}
	],
	version: 3
};

export const transactionListUnconfirmedResponse = [
	transferUnconfirmedListItemResponse,
	hashLockUnconfirmedListItemResponse,
	aggregateCompleteUnconfirmedListItemResponse
];
