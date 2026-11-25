export const transferUnconfirmedListItem = {
	type: 'TRANSFER',
	group: 'unconfirmed',
	hash: '4BE56A3185E7748434C33D96F54EB0B1867FA5365797B32038D96CE2D065FB86',
	timestamp: null,
	signer: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
	account: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	direction: null,
	height: null,
	fee: null,
	amount: 20.601464,
	value: [
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
	]
};

export const hashLockUnconfirmedListItem = {
	type: 'HASH_LOCK',
	group: 'unconfirmed',
	hash: '6D2A21E0D436A84F3374A4E6D4ADC4879B5FAF0E480ABBC5EBBA3604EC1B9C6D',
	timestamp: null,
	signer: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	sender: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	recipient: null,
	account: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	direction: null,
	height: null,
	fee: null,
	amount: 0,
	value: []
};

export const aggregateCompleteUnconfirmedListItem = {
	type: 'AGGREGATE_COMPLETE',
	group: 'unconfirmed',
	hash: 'DFF89FB0B71EFEF6B2F08677FE2F29C8E93C808DA13093B66909C3B30E9F829C',
	timestamp: null,
	signer: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	recipient: null,
	account: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	direction: null,
	height: null,
	fee: null,
	amount: 0,
	value: []
};

export const transactionListUnconfirmed = [
	transferUnconfirmedListItem,
	hashLockUnconfirmedListItem,
	aggregateCompleteUnconfirmedListItem
];
