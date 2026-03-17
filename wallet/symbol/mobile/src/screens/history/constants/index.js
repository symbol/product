import { EthereumTransactionType, SymbolTransactionType } from '@/app/constants';

export const TransferTypes = [
	SymbolTransactionType.TRANSFER,
	EthereumTransactionType.TRANSFER,
	EthereumTransactionType.ERC_20_TRANSFER,
	EthereumTransactionType.ERC_20_BRIDGE_TRANSFER
];

export const AggregateTypes = [
	SymbolTransactionType.AGGREGATE_COMPLETE,
	SymbolTransactionType.AGGREGATE_BONDED
];

export const LoseAccessWarningTypes = [
	SymbolTransactionType.MULTISIG_ACCOUNT_MODIFICATION,
	SymbolTransactionType.SECRET_LOCK,
	SymbolTransactionType.ACCOUNT_ADDRESS_RESTRICTION,
	SymbolTransactionType.ACCOUNT_MOSAIC_RESTRICTION,
	SymbolTransactionType.ACCOUNT_OPERATION_RESTRICTION
];

export const DB_UPDATE_LATENCY_AFTER_ANNOUNCE = 1000;
export const REFRESH_TRANSACTION_DETAILS_INTERVAL = 10000;
