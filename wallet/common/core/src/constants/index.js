export const DEFAULT_ACCOUNT_NAME = 'My Account';

export const MAX_SEED_ACCOUNTS_PER_NETWORK = 10;

export const ControllerEventName = {
	ERROR: 'wc:error',
	STATE_CHANGE: 'wc:state.change',
	WALLET_CLEAR: 'wc:wallet.logout',
	WALLET_CREATE: 'wc:wallet.login',
	NEW_TRANSACTION_CONFIRMED: 'wc:transaction.add.confirmed',
	NEW_TRANSACTION_UNCONFIRMED: 'wc:transaction.add.unconfirmed',
	NEW_TRANSACTION_PARTIAL: 'wc:transaction.add.partial',
	REMOVE_TRANSACTION_UNCONFIRMED: 'wc:transaction.remove.unconfirmed',
	TRANSACTION_ERROR: 'wc:transaction.error',
	ACCOUNT_CHANGE: 'wc:account.change',
	ACCOUNT_INFO_CHANGE: 'wc:account.info.change',
	NETWORK_CHANGE: 'wc:network.change',
	NETWORK_STATUS_CHANGE: 'wc:network.status.change',
	NETWORK_PROPERTIES_CHANGE: 'wc:network.properties.change'
};

export const NetworkConnectionStatus = {
	INITIAL: 'initial',
	CONNECTED: 'connected',
	NO_INTERNET: 'no-internet',
	FAILED_CUSTOM_NODE: 'failed-custom-node',
	CONNECTING: 'connecting'
};

export const WalletAccountType = {
	MNEMONIC: 'mnemonic',
	EXTERNAL: 'external',
	LEDGER: 'ledger',
	TREZOR: 'trezor'
};

export const TransactionGroup = {
	CONFIRMED: 'confirmed',
	UNCONFIRMED: 'unconfirmed',
	PARTIAL: 'partial',
	FAILED: 'failed'
};

export const REQUIRED_API_METHODS = [
	'account.fetchAccountInfo',
	'transaction.fetchAccountTransactions',
	'transaction.announceTransaction',
	'network.fetchNetworkProperties',
	'network.pingNode',
	'network.fetchNodeList',
	'listener.createListener'
];

export const REQUIRED_SDK_METHODS = [
	'signTransaction',
	'cosignTransaction',
	'encryptMessage',
	'decryptMessage',
	'createPrivateAccount',
	'createPrivateKeysFromMnemonic'
];
