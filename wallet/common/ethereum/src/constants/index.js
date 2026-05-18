export const TransactionGroup = {
	CONFIRMED: 'confirmed',
	UNCONFIRMED: 'unconfirmed'
};

export const TransactionAnnounceGroup = {
	DEFAULT: 'default'
};

export const TransactionType = {
	RESERVED: 0,
	TRANSFER: 1,
	ERC_20_TRANSFER: 2,
	ERC_20_BRIDGE_TRANSFER: 3,
	UNISWAP_SWAP: 4,
	ERC_20_APPROVE: 5
};

export const ChainId = {
	MAIN_NET: 1,
	TESTNET: 3151908,
	SEPOLIA: 11155111
};

export const NetworkIdentifier = {
	MAIN_NET: 'mainnet',
	TESTNET: 'testnet',
	SEPOLIA: 'sepolia'
};

export const NETWORK_CURRENCY_TICKER = 'ETH';
export const NETWORK_CURRENCY_NAME = 'Ether';
export const NETWORK_CURRENCY_ID = 'eth';
export const NETWORK_CURRENCY_DIVISIBILITY = 18;
