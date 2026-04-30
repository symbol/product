import { EthereumTransactionType, SymbolTransactionType } from '@/app/constants';
import { createTransactionGraphicData } from '@/app/screens/history/utils/transaction-graphic';
import { objectToTableData } from '@/app/utils';
import { omit } from 'lodash';

const TRANSFER_TYPES = [
	SymbolTransactionType.TRANSFER, 
	EthereumTransactionType.TRANSFER,
	EthereumTransactionType.ERC_20_TRANSFER,
	EthereumTransactionType.ERC_20_BRIDGE_TRANSFER
];

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Table').TableRow} TableRow */
/** @typedef {import('@/app/screens/history/types/TransactionDetails').TransactionCardData} TransactionCardData */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */

/**
 * Options for creating transaction card data.
 * @typedef {object} CardListDataOptions
 * @property {ChainName} chainName - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @property {NetworkIdentifier} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @property {string} nativeCurrencyTicker - The ticker symbol for the native currency.
 * @property {string} nativeCurrencyTokenId - The token ID for the native currency.
 * @property {WalletAccount[]} [walletAccounts] - The list of wallet accounts.
 * @property {object} [addressBook] - The address book instance.
 */

/**
 * Creates generic table rows from transaction.
 * @param {Transaction} transaction - Transaction to extract base details from.
 * @returns {TableRow[]} Base transaction detail rows.
 */
export const createTransactionBaseTableData = transaction => {
	const { hash, fee, signerAddress, receivedCosignatures } = transaction;
    
	return objectToTableData({ 
		hash, 
		fee, 
		transactionInitiator: signerAddress, 
		receivedCosignatures 
	});
};

/**
 * Creates table rows specific to a transaction body.
 * @param {Transaction} transaction - Transaction to extract specific details from.
 * @returns {TableRow[]} Transaction-specific detail rows.
 */
export const createTransactionSpecificTableData = transaction => {
	const specificData = omit(transaction, [
		'hash',
		'id',
		'type',
		'amount',
		'fee',
		'status',
		'height',
		'innerTransactions',
		'cosignatures',
		'receivedCosignatures',
		'deadline',
		'timestamp',
		'signerPublicKey',
		'sourceAddress',
		'lockedAmount',
		'aggregateHash'
	]);

	let finalData = specificData;
	if (TRANSFER_TYPES.includes(transaction.type)) {
		const { signerAddress, recipientAddress, ...rest } = specificData;
		finalData = { 
			senderAddress: signerAddress, 
			recipientAddress,
			...rest
		};
	}


	return objectToTableData(finalData);
};

/**
 * Creates the list of data used to present transaction graphic and
 * table with rows specific to a transaction body. Rendered in cards.
 * @param {Transaction} transaction - Transaction to convert into card data.
 * @param {CardListDataOptions} options - Options for creating the card data.
 * @returns {TransactionCardData[]} Transaction detail cards.
 */
export const createdCardListData = (transaction, options) => {
	const isAggregateTransaction = transaction.type === SymbolTransactionType.AGGREGATE_COMPLETE 
        || transaction.type === SymbolTransactionType.AGGREGATE_BONDED;

	if (!isAggregateTransaction) {
		const data = {
			table: createTransactionSpecificTableData(transaction),
			graphic: createTransactionGraphicData(transaction, options)
		};

		return [data];
	}

	return transaction.innerTransactions.map(innerTx => ({
		table: createTransactionSpecificTableData(innerTx),
		graphic: createTransactionGraphicData(innerTx, options)
	}));
};
