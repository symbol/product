const config = {
	language : {
		nemAddress: 'NEM Address',
		nemBalance: 'NEM Balance',
		symbolAddress: 'Symbol Address',
		symbolBalance: 'Symbol Balance',
		optinTransactionHash: 'Optin Transaction Hash',
		status: 'Status',
		message: 'Message',
		optin_id: 'Opt-in ID'
	},
	keyRedirects: {
		nemAddress: 'https://explorer.nemtool.com/#/s_account?account=',
		symbolAddress: 'https://symbol.fyi/accounts/',
		optinTransactionHash: 'https://explorer.nemtool.com/#/s_tx?hash=',
		payoutTransactionHash: 'https://symbol.fyi/transactions/',
		nemHashes: 'https://explorer.nemtool.com/#/s_tx?hash=',
		symbolHashes: 'https://symbol.fyi/transactions/'
	},
	keyFormat: {
		nemBalance: 'relative',
		symbolBalance: 'relative',
		optinTransactionHash: 'uppercase'
	}
};

export default config;