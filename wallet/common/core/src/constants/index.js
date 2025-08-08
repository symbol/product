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
	REMOVE_TRANSACTION_PARTIAL: 'wc:transaction.remove.partial',
	TRANSACTION_ERROR: 'wc:transaction.error',
	ACCOUNT_CHANGE: 'wc:account.change',
	ACCOUNT_INFO_CHANGE: 'wc:account.info.change',
	NETWORK_CHANGE: 'wc:network.change',
	NETWORK_STATUS_CHANGE: 'wc:network.status.change',
	NETWORK_PROPERTIES_CHANGE: 'wc:network.properties.change'
};

export const ErrorCode = {
	FAILED_ACCESS_KEYSTORE: 'error_failed_access_keystore',
	WALLET_SELECTED_ACCOUNT_MISSING: 'error_wallet_selected_account_missing',
	WALLET_ADD_ACCOUNT_ALREADY_EXISTS: 'error_failed_add_account_already_exists',
	WALLET_REMOVE_CURRENT_ACCOUNT: 'error_wallet_remove_current_account',
	WALLET_ACCOUNT_NOT_FOUND: 'error_wallet_account_not_found',
	WALLET_NETWORK_NOT_SUPPORTED: 'error_change_network_not_supported',
	FETCH_INVALID_REQUEST: 'error_fetch_invalid_request',
	FETCH_UNAUTHORIZED: 'error_fetch_unauthorized',
	FETCH_NOT_FOUND: 'error_fetch_not_found',
	FETCH_RATE_LIMIT: 'error_fetch_rate_limit',
	FETCH_SERVER_ERROR: 'error_fetch_server_error',
	NETWORK_REQUEST_ERROR: 'error_network_request_error',
	NETWORK_LISTENER_START_ERROR: 'error_chain_listener_start',
	NETWORK_PROPERTIES_WRONG_NETWORK: 'error_fetch_network_properties_wrong_network',
	ADDRESS_BOOK_ADD_CONTACT_ALREADY_EXISTS: 'error_failed_add_contact_already_exists',
	ADDRESS_BOOK_REMOVE_CONTACT_NOT_FOUND: 'error_failed_remove_contact_not_found',
	ADDRESS_BOOK_UPDATE_CONTACT_NOT_FOUND: 'error_failed_update_contact_not_found',
	KEYSTORE_ERROR: 'error_keystore',
	API_ERROR: 'error_api',
	SDK_ERROR: 'error_sdk',
	CONTROLLER_ERROR: 'error_controller'
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
	'network.fetchNetworkInfo',
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
