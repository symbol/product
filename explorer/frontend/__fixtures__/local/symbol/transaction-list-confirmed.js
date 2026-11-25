export const embeddedTransferConfirmedListItem = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C',
	timestamp: '2026-11-25 11:07:54',
	signer: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	sender: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	recipient: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	account: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	direction: null,
	height: 3922560,
	fee: null,
	amount: 0,
	value: []
};

export const embeddedMultisigAccountModificationConfirmedListItem = {
	type: 'MULTISIG_ACCOUNT_MODIFICATION',
	group: 'confirmed',
	hash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C',
	timestamp: '2026-11-25 11:07:54',
	signer: 'TDAAG7HUZI7NUWTFCLHQFODTPJ5AQRJ7XJ4LDXQ',
	sender: 'TDAAG7HUZI7NUWTFCLHQFODTPJ5AQRJ7XJ4LDXQ',
	recipient: null,
	account: 'TDAAG7HUZI7NUWTFCLHQFODTPJ5AQRJ7XJ4LDXQ',
	direction: null,
	height: 3922560,
	fee: null,
	amount: 0,
	value: []
};

export const aggregateCompleteConfirmedListItem = {
	type: 'AGGREGATE_COMPLETE',
	group: 'confirmed',
	hash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C',
	timestamp: '2026-11-25 11:07:54',
	signer: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	sender: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	recipient: null,
	account: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	direction: null,
	height: 3922560,
	fee: 0.187704,
	amount: 0,
	value: []
};

export const mosaicDefinitionConfirmedListItem = {
	type: 'MOSAIC_DEFINITION',
	group: 'confirmed',
	hash: '9D70BEEDEAD9BE028F51CF279E509E5180D41858E1DE98CA466E5CD131B686A8',
	timestamp: '2026-11-25 02:53:23',
	signer: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	recipient: null,
	account: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	direction: null,
	height: 3921571,
	fee: 0.015,
	amount: 0,
	value: [
		{
			amount: 0,
			id: '406FE5941F06BCBE',
			name: '406FE5941F06BCBE'
		}
	]
};

export const hashLockConfirmedListItem = {
	type: 'HASH_LOCK',
	group: 'confirmed',
	hash: '6D2A21E0D436A84F3374A4E6D4ADC4879B5FAF0E480ABBC5EBBA3604EC1B9C6D',
	timestamp: '2026-11-24 13:31:17',
	signer: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	sender: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	recipient: null,
	account: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	direction: null,
	height: 3919965,
	fee: 0.0276,
	amount: 0,
	value: [
		{
			amount: 10,
			id: '72C0212E67A08BCE',
			name: 'symbol.xym'
		}
	]
};

export const transferConfirmedListItem = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '4BE56A3185E7748434C33D96F54EB0B1867FA5365797B32038D96CE2D065FB86',
	timestamp: '2026-11-22 03:10:54',
	signer: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
	account: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	direction: null,
	height: 3912970,
	fee: 0.49987,
	amount: 20.601464,
	value: [
		{
			amount: 20.601464,
			id: '72C0212E67A08BCE',
			name: 'symbol.xym'
		}
	]
};

export const transactionListConfirmed = [
	embeddedTransferConfirmedListItem,
	embeddedMultisigAccountModificationConfirmedListItem,
	aggregateCompleteConfirmedListItem,
	mosaicDefinitionConfirmedListItem,
	hashLockConfirmedListItem,
	transferConfirmedListItem
];
