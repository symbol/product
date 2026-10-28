import { TransactionKind } from '@/app/constants';
import { createTransactionBodyFields, getTransactionTypeInfo } from '@/app/lib/transaction';
import { createTransactionGraphicData } from '@/app/screens/history/utils/transaction-graphic';
import { objectToTableData } from '@/app/utils';

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
 * Creates table rows specific to a transaction body. The fields to show come from the display helpers of its chain.
 * @param {Transaction} transaction - Transaction to extract specific details from.
 * @param {ChainName} chainName - The name of the blockchain the transaction belongs to.
 * @returns {TableRow[]} Transaction-specific detail rows.
 */
export const createTransactionBodyTableData = (transaction, chainName) =>
	objectToTableData(createTransactionBodyFields(transaction, chainName));

/**
 * Creates the list of data used to present transaction graphic and
 * table with rows specific to a transaction body. Rendered in cards.
 * @param {Transaction} transaction - Transaction to convert into card data.
 * @param {CardListDataOptions} options - Options for creating the card data.
 * @returns {TransactionCardData[]} Transaction detail cards.
 */
export const createdCardListData = (transaction, options) => {
	const { kind } = getTransactionTypeInfo(transaction.type, options.chainName);

	if (kind !== TransactionKind.AGGREGATE) {
		const data = {
			table: createTransactionBodyTableData(transaction, options.chainName),
			graphic: createTransactionGraphicData(transaction, options)
		};

		return [data];
	}

	return transaction.innerTransactions.map(innerTx => ({
		table: createTransactionBodyTableData(innerTx, options.chainName),
		graphic: createTransactionGraphicData(innerTx, options)
	}));
};
