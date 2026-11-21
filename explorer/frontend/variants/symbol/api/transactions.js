import { stubTransactions } from './fixtures';
import { stubPage, stubValue } from './stub';
import { SYMBOL_TRANSACTION_GROUP, SYMBOL_TRANSACTION_TYPE } from '../constants';
import { formatTransferMessage } from '../utils/transactions';
import config from '@/app/config';
import { TRANSACTION_DIRECTION } from '@/app/constants';
import { createApiUrl, createPage, createSearchCriteria, makeRequest } from '@/app/utils/server';

const fetchStubTransactionPage = stubPage(stubTransactions);

/**
 * Fetches pending transactions from Explorer REST, retaining fixtures for other groups.
 * @param {object} [searchParams] - page parameters and transaction group.
 * @returns {Promise<object>} transaction page.
 */
export const fetchTransactionPage = async searchParams => {
	const { pageNumber, filter } = createSearchCriteria(searchParams);
	if (filter.group !== SYMBOL_TRANSACTION_GROUP.UNCONFIRMED)
		return fetchStubTransactionPage(searchParams);

	const transactions = await makeRequest(createApiUrl('transactions/unconfirmed'));

	return createPage(transactions, pageNumber, data => transactionFromDTO(data, filter));
};

export const fetchTransactionInfo = stubValue(stubTransactions[0]);

const transactionFromDTO = (data, filter = {}) => {
	switch (data.transactionType) {
	case SYMBOL_TRANSACTION_TYPE.TRANSFER:
		return formatTransferTransaction(data, filter);
	case SYMBOL_TRANSACTION_TYPE.AGGREGATE_COMPLETE:
	case SYMBOL_TRANSACTION_TYPE.AGGREGATE_BONDED:
		return formatAggregateTransaction(data, filter);
	default:
		// REST already normalizes transaction-specific payloads. Preserve them until
		// a consuming view needs a type-specific presentation shape.
		return formatBaseTransaction(data, filter);
	}
};

const formatBaseTransaction = (data, filter) => {
	const sender = data.fromAddress;
	const recipient = data.toAddress;
	const isOutgoing = sender === filter.address;
	const isIncoming = recipient === filter.address;

	return {
		type: data.transactionType,
		group: filter.group || SYMBOL_TRANSACTION_GROUP.CONFIRMED,
		hash: data.transactionHash,
		timestamp: data.timestamp,
		deadline: data.deadline,
		signer: sender,
		sender,
		recipient,
		account: isOutgoing ? recipient : sender,
		direction: isOutgoing ? TRANSACTION_DIRECTION.OUTGOING : isIncoming ? TRANSACTION_DIRECTION.INCOMING : null,
		height: data.height || null,
		signature: data.signature,
		fee: data.fee,
		amount: 0,
		value: [],
		body: [{ ...data.value[0], type: data.transactionType, sender, recipient }],
		size: data.size,
		version: data.version
	};
};

const formatTransferTransaction = (data, filter) => {
	const mosaics = [];
	let message = null;

	data.value.forEach(item => {
		if (Object.hasOwn(item, 'id') && Object.hasOwn(item, 'amount'))
			mosaics.push({ id: item.id, name: item.name || item.id, amount: item.amount });
		if (item.message)
			message = formatTransferMessage(item.message.type, item.message.payload);
	});

	mosaics.sort((x, y) => (x.id === filter.mosaic ? -1 : y.id === filter.mosaic ? 1 : 0));

	return {
		...formatBaseTransaction(data, filter),
		amount: mosaics.find(mosaic => mosaic.id === config.PUBLIC_NATIVE_MOSAIC_ID)?.amount ?? 0,
		value: mosaics,
		body: [{ type: data.transactionType, sender: data.fromAddress, recipient: data.toAddress, mosaics, message }]
	};
};

const formatAggregateTransaction = (data, filter) => {
	const transactions = (data.embeddedTransactions || []).map(transaction => transactionFromDTO(transaction, filter));

	return {
		...formatBaseTransaction(data, filter),
		amount: transactions.reduce((total, transaction) => total + transaction.amount, 0),
		value: transactions.flatMap(transaction => transaction.value),
		body: transactions.flatMap(transaction => transaction.body)
	};
};
