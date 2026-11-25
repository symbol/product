export const embeddedTransferConfirmedListItemResponse = {
	aggregateHash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C',
	amount: 0,
	embeddedIndex: 1,
	fee: null,
	group: 'confirmed',
	hash: null,
	height: 3922560,
	isEmbedded: true,
	message: null,
	recipient: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	sender: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	signer: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	timestamp: '2026-11-25 11:07:54',
	type: 'TRANSFER',
	value: []
};

export const embeddedMultisigAccountModificationConfirmedListItemResponse = {
	aggregateHash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C',
	amount: 0,
	embeddedIndex: 0,
	fee: null,
	group: 'confirmed',
	hash: null,
	height: 3922560,
	isEmbedded: true,
	message: null,
	recipient: null,
	sender: 'TDAAG7HUZI7NUWTFCLHQFODTPJ5AQRJ7XJ4LDXQ',
	signer: 'TDAAG7HUZI7NUWTFCLHQFODTPJ5AQRJ7XJ4LDXQ',
	timestamp: '2026-11-25 11:07:54',
	type: 'MULTISIG_ACCOUNT_MODIFICATION',
	value: []
};

export const aggregateCompleteConfirmedListItemResponse = {
	aggregateHash: null,
	amount: 0,
	embeddedIndex: null,
	fee: 0.187704,
	group: 'confirmed',
	hash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C',
	height: 3922560,
	isEmbedded: false,
	message: null,
	recipient: null,
	sender: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	signer: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	timestamp: '2026-11-25 11:07:54',
	type: 'AGGREGATE_COMPLETE',
	value: []
};

export const mosaicDefinitionConfirmedListItemResponse = {
	aggregateHash: null,
	amount: 0,
	embeddedIndex: null,
	fee: 0.015,
	group: 'confirmed',
	hash: '9D70BEEDEAD9BE028F51CF279E509E5180D41858E1DE98CA466E5CD131B686A8',
	height: 3921571,
	isEmbedded: false,
	message: null,
	recipient: null,
	sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	signer: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	timestamp: '2026-11-25 02:53:23',
	type: 'MOSAIC_DEFINITION',
	value: [
		{
			amount: 0,
			id: '406FE5941F06BCBE',
			name: '406FE5941F06BCBE'
		}
	]
};

export const hashLockConfirmedListItemResponse = {
	aggregateHash: null,
	amount: 0,
	embeddedIndex: null,
	fee: 0.0276,
	group: 'confirmed',
	hash: '6D2A21E0D436A84F3374A4E6D4ADC4879B5FAF0E480ABBC5EBBA3604EC1B9C6D',
	height: 3919965,
	isEmbedded: false,
	message: null,
	recipient: null,
	sender: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	signer: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	timestamp: '2026-11-24 13:31:17',
	type: 'HASH_LOCK',
	value: [
		{
			amount: 10,
			id: '72C0212E67A08BCE',
			name: 'symbol.xym'
		}
	]
};

export const transferConfirmedListItemResponse = {
	aggregateHash: null,
	amount: 20.601464,
	embeddedIndex: null,
	fee: 0.49987,
	group: 'confirmed',
	hash: '4BE56A3185E7748434C33D96F54EB0B1867FA5365797B32038D96CE2D065FB86',
	height: 3912970,
	isEmbedded: false,
	message: {
		text: 'Refund-2',
		type: 'plain'
	},
	recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
	sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	signer: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	timestamp: '2026-11-22 03:10:54',
	type: 'TRANSFER',
	value: [
		{
			amount: 20.601464,
			id: '72C0212E67A08BCE',
			name: 'symbol.xym'
		}
	]
};

export const transactionListConfirmedResponse = [
	embeddedTransferConfirmedListItemResponse,
	embeddedMultisigAccountModificationConfirmedListItemResponse,
	aggregateCompleteConfirmedListItemResponse,
	mosaicDefinitionConfirmedListItemResponse,
	hashLockConfirmedListItemResponse,
	transferConfirmedListItemResponse
];
