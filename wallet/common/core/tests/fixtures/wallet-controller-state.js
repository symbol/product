import { currentAccount, currentNetworkIdentifier, walletAccounts } from './wallet';

export const defaultState = {
	isCacheLoaded: false,
	networkIdentifier: currentNetworkIdentifier,
	networkProperties: {
		nodeUrl: null,
		nodeUrls: [],
		networkIdentifier: currentNetworkIdentifier,
		chainHeight: null,
		other: {}
	},
	networkStatus: 'initial',
	nodeUrls: {
		testnet: [],
		mainnet: []
	},
	selectedNodeUrl: null,

	walletAccounts: {
		testnet: [],
		mainnet: []
	},
	accountInfos: {
		testnet: {},
		mainnet: {}
	},
	currentAccountPublicKey: null,
	seedAddresses: {
		testnet: [],
		mainnet: []
	},
	latestTransactions: {
		testnet: {},
		mainnet: {}
	}
};

export const filledState = {
	isCacheLoaded: true,
	networkIdentifier: currentNetworkIdentifier,
	networkProperties: {
		nodeUrl: 'http://testnet-node1',
		nodeUrls: ['http://testnet-node1', 'http://mainnet-node1'],
		networkIdentifier: currentNetworkIdentifier,
		chainHeight: 100,
		other: { someProperty: 'value' }
	},
	networkStatus: 'connected',
	nodeUrls: {
		testnet: ['http://testnet-node1'],
		mainnet: ['http://mainnet-node1']
	},
	selectedNodeUrl: 'http://testnet-node1',
	walletAccounts: {
		testnet: [
			walletAccounts.testnet[0],
			walletAccounts.testnet[1]
		],
		mainnet: [
			walletAccounts.mainnet[0],
			walletAccounts.mainnet[1]
		]
	},
	accountInfos: {
		testnet: { T123: { balance: 1000 } },
		mainnet: { N123: { balance: 12 } }
	},
	currentAccountPublicKey: currentAccount.publicKey,
	seedAddresses: {
		testnet: [
			walletAccounts.testnet[2],
			walletAccounts.testnet[3]
		],
		mainnet: [
			walletAccounts.mainnet[2],
			walletAccounts.mainnet[3]
		]
	},
	latestTransactions: {
		testnet: {
			[walletAccounts.testnet[0].publicKey]: [{
				transactionId: 'TX123',
				amount: 100,
				timestamp: 1622547800
			}]
		},
		mainnet: {
			[walletAccounts.mainnet[0].publicKey]: [{
				transactionId: 'TX321',
				amount: 12,
				timestamp: 1622547800
			}]
		}
	}
};
