export const MAX_SEED_ACCOUNTS_PER_NETWORK = 10;

export const NetworkIdentifier = {
	MAIN_NET: 'mainnet',
	TEST_NET: 'testnet'
};

export const MessageType = {
	PLAIN_TEXT: 0,
	ENCRYPTED_TEXT: 1,
	DELEGATED_HARVESTING: 254
};

export const ActivityStatus = {
	PENDING: 'pending',
	COMPLETE: 'complete',
	ERROR: 'error',
	LOADING: 'loading'
};

export const PasscodeMode = {
	CREATE: 'create',
	VERIFY: 'verify'
};

export const PASSCODE_PIN_LENGTH = 4;
export const PASSCODE_MAX_FAILED_ATTEMPTS = 10;
export const PASSCODE_LOCKOUT_DURATION_MS = 60000;

export { TransactionType as SymbolTransactionType } from 'wallet-common-symbol/src/constants';

export { TransactionType as EthereumTransactionType } from 'wallet-common-ethereum/src/constants';

export { TransactionGroup } from 'wallet-common-core/src/constants';
