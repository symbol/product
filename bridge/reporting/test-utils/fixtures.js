export const CONFIGURATION = {
	nativeNetwork: {
		blockchain: 'symbol',
		explorerUrl: 'https://symbol.example'
	},
	wrappedNetwork: {
		blockchain: 'ethereum',
		explorerUrl: 'https://ethereum.example'
	}
};

export const REQUEST_ROW = {
	destinationAddress: '0x1f533cd9711049fA7604D0F49C45B6e5Af30ef8e',
	errorMessage: null,
	payoutConversionRate: '1000000',
	payoutNetAmount: '299642570825',
	payoutSentTimestamp: 4,
	payoutStatus: 2,
	payoutTimestamp: 3,
	payoutTotalFee: '357429175',
	payoutTransactionHash: 'A'.repeat(64),
	payoutTransactionHeight: '11',
	requestAmount: '300000000000',
	requestTimestamp: 2,
	requestTransactionHash: 'B'.repeat(64),
	requestTransactionHeight: '10',
	requestTransactionSubindex: -1,
	senderAddress: 'TCONKG47FW2ZEZBPV6G7F422LXBDSMVT3JMYM4I'
};

export const REQUEST_TAB = {
	id: 'xym-wxym-requests',
	label: 'XYM → WXYM',
	operation: 'wrap',
	resource: 'requests',
	sourceAsset: { ticker: 'XYM', divisibility: 6 },
	destinationAsset: { ticker: 'WXYM', divisibility: 6 },
	sourceNetwork: 'nativeNetwork',
	destinationNetwork: 'wrappedNetwork'
};

export const ERROR_TAB = { ...REQUEST_TAB, id: 'xym-wxym-errors', resource: 'errors' };

export const ERROR_ROW = {
	errorMessage: 'Required message is missing',
	requestTimestamp: 5,
	requestTransactionHash: 'C'.repeat(64),
	requestTransactionHeight: '13',
	requestTransactionSubindex: -1,
	senderAddress: 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY'
};
