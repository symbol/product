// Contract-based data matching SymbolTransactionView.to_dict; not captured from a live API.
export const transactionResponse = {
	hash: 'AB'.repeat(32),
	isEmbedded: false,
	aggregateHash: null,
	embeddedIndex: null,
	group: 'confirmed',
	height: 123,
	type: 'TRANSFER',
	sender: 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y',
	signer: 'TBFFBEEWH3HNT52R626IA6SAAUC5BQQXA4CC32Y',
	recipient: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
	value: [{ id: '72C0212E67A08BCE', name: 'symbol.xym', amount: 1.25 }],
	amount: 1.25,
	fee: 0.0125,
	timestamp: '2026-10-16 01:02:03',
	message: { type: 'plain', text: 'confirmed message' }
};
