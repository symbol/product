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
