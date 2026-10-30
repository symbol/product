import { UNKNOWN_TRANSACTION_TYPE_INFO } from './common-transaction-types';
import { TransactionKind } from '@/app/constants';
import { TransactionType } from 'wallet-common-ethereum/src/constants';

/** @typedef {import('@/app/types/Transaction').TransactionTypeInfo} TransactionTypeInfo */

const ethereumTransactionTypeInfos = {
	[TransactionType.TRANSFER]: {
		kind: TransactionKind.TRANSFER,
		localeKey: 'transactionType_transfer',
		icon: 'transfer'
	},
	[TransactionType.ERC_20_TRANSFER]: {
		kind: TransactionKind.TRANSFER,
		localeKey: 'transactionType_erc20Transfer',
		icon: 'transfer'
	},
	[TransactionType.ERC_20_BRIDGE_TRANSFER]: {
		kind: TransactionKind.TRANSFER,
		localeKey: 'transactionType_erc20BridgeTransfer',
		icon: 'transfer'
	},
	[TransactionType.UNISWAP_SWAP]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_uniswapSwap',
		icon: 'swap'
	},
	[TransactionType.ERC_20_APPROVE]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_erc20Approve',
		icon: 'default'
	}
};

/**
 * Returns the resolved UI ready transaction type info.
 * @param {number} type - Raw Ethereum transaction type value.
 * @returns {TransactionTypeInfo} Resolved UI ready data.
 */
export const getEthereumTransactionTypeInfo = type => ethereumTransactionTypeInfos[type] ?? UNKNOWN_TRANSACTION_TYPE_INFO;
