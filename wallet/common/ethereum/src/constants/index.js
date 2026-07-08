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
	TESTNET: 11155111
};

export const NetworkIdentifier = {
	MAIN_NET: 'mainnet',
	TESTNET: 'testnet'
};

export const NETWORK_CURRENCY_TICKER = 'ETH';
export const NETWORK_CURRENCY_NAME = 'Ether';
export const NETWORK_CURRENCY_ID = 'eth';
export const NETWORK_CURRENCY_DIVISIBILITY = 18;

// Percentage added to eth_estimateGas results to reduce the risk of out-of-gas failures 
// caused by gas estimation underestimating some contract executions. 
// This only increases the transaction's gas limit (execution cap); unused gas is not charged.
export const GAS_LIMIT_SAFETY_MARGIN_PERCENTAGE = 20n;
