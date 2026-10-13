export const transferUnconfirmedTransactionResponse = {
	deadline: '2026-10-07 17:47:38',
	embeddedTransactions: null,
	fee: 0.1,
	fromAddress: 'TBCJO54GA42OLIKPIM2MLAQWLFCGJOZPN4NILBCJ',
	height: 0,
	signature:
		'2FEE2368EA576F563391D01065973028576263C8CFB161B4E39CAA26E035513A03EEB4D6E13DF2C5506BB50FCCEEEF494F96AA101830A9161FB3C9806C75800B',
	size: 198,
	timestamp: '2026-10-07 16:47:38',
	toAddress: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
	transactionHash: null,
	transactionType: 'TRANSFER',
	value: [
		{
			message: {
				payload: '48656c6c6f21',
				type: 1
			}
		},
		{
			amount: 12,
			namespace: 'nem.xem'
		}
	],
	version: 1
};

export const transactionListUnconfirmedResponse = [transferUnconfirmedTransactionResponse];
