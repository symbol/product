import { stubTransactions } from './fixtures';
import { stubValue } from './stub';
import { SYMBOL_TRANSACTION_GROUP } from '../constants';
import { TRANSACTION_DIRECTION } from '@/app/constants';
import { createApiUrl, createPage, createSearchURL, makeRequest } from '@/app/utils/server';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 250;
const MAX_TRANSACTION_OFFSET = 100000;

const isPresent = value => value !== undefined && value !== null;

const parseInteger = (value, defaultValue, parameterName) => {
	if (!isPresent(value))
		return defaultValue;

	if (typeof value === 'boolean')
		throw new Error(`${parameterName} must be an integer`);

	const parsedValue = Number(value);
	if (!Number.isSafeInteger(parsedValue))
		throw new Error(`${parameterName} must be an integer`);

	return parsedValue;
};

const getPagination = searchParams => {
	const pageSize = parseInteger(searchParams.pageSize, DEFAULT_PAGE_SIZE, 'pageSize');
	if (pageSize < 1 || pageSize > MAX_PAGE_SIZE)
		throw new Error(`pageSize must be between 1 and ${MAX_PAGE_SIZE}`);

	const pageNumber = parseInteger(searchParams.pageNumber, 1, 'pageNumber');
	if (pageNumber < 1)
		throw new Error('pageNumber must be greater than or equal to 1');

	const offset = pageSize * (pageNumber - 1);
	if (offset > MAX_TRANSACTION_OFFSET)
		throw new Error(`offset must be between 0 and ${MAX_TRANSACTION_OFFSET}`);

	return { pageNumber, pageSize, offset };
};

const getTransactionFilters = searchParams => {
	const { address, from, to, group, types, height, mosaic, signerPublicKey, embedded, order } = searchParams;
	if (isPresent(group) && group !== SYMBOL_TRANSACTION_GROUP.CONFIRMED)
		throw new Error(`Symbol transaction group is not supported: ${group}`);

	const hasAddress = isPresent(address);
	const hasFrom = isPresent(from);
	const hasTo = isPresent(to);
	if (hasAddress && hasFrom && hasTo)
		throw new Error('address cannot be combined with both from and to');

	if (hasAddress && !hasFrom && !hasTo && isPresent(signerPublicKey))
		throw new Error('address cannot be combined with signerPublicKey');

	if (isPresent(embedded) && !(embedded === false || (typeof embedded === 'string' && embedded.toLowerCase() === 'false')))
		throw new Error('embedded Symbol transactions are not supported by the shared transaction list');

	const normalizedOrder = isPresent(order) ? `${order}`.toUpperCase() : 'DESC';
	if (normalizedOrder !== 'DESC')
		throw new Error('order must be DESC');

	const filters = {};
	if (isPresent(height))
		filters.height = height;

	if (isPresent(types) && (!Array.isArray(types) || types.length))
		filters.transactionTypes = Array.isArray(types) ? types.join(',') : types;

	if (hasAddress && hasFrom) {
		filters.senderAddress = from;
		filters.recipientAddress = address;
	} else if (hasAddress && hasTo) {
		filters.senderAddress = address;
		filters.recipientAddress = to;
	} else if (hasAddress) {
		filters.address = address;
	} else {
		if (hasFrom)
			filters.senderAddress = from;
		if (hasTo)
			filters.recipientAddress = to;
	}

	if (isPresent(signerPublicKey))
		filters.signerPublicKey = signerPublicKey;
	if (isPresent(mosaic))
		filters.mosaic = mosaic;

	filters.embedded = 'false';
	filters.order = normalizedOrder;

	return filters;
};

const transactionFromREST = (transaction, address) => {
	const isOutgoing = isPresent(address) && transaction.sender === address;
	const isIncoming = isPresent(address) && transaction.recipient === address;

	return {
		...transaction,
		account: isOutgoing ? transaction.recipient : transaction.sender,
		direction: isOutgoing
			? TRANSACTION_DIRECTION.OUTGOING
			: isIncoming
				? TRANSACTION_DIRECTION.INCOMING
				: null
	};
};

/**
 * Fetches a confirmed Symbol transaction page from Explorer REST.
 * @param {object} [searchParams] - shared page and transaction filter parameters.
 * @returns {Promise<object>} the transaction page with Symbol account direction fields.
 */
export const fetchTransactionPage = async (searchParams = {}) => {
	const params = searchParams ?? {};
	const pagination = getPagination(params);
	const filters = getTransactionFilters(params);
	const url = createSearchURL(createApiUrl('transactions'), { ...pagination, filter: filters });
	const transactions = await makeRequest(url);

	if (!Array.isArray(transactions))
		throw new Error('Symbol transactions response must be an array');

	const formatter = transaction => transactionFromREST(transaction, params.address);
	const isLastPage = !transactions.length || pagination.offset + pagination.pageSize > MAX_TRANSACTION_OFFSET;

	return { ...createPage(transactions, pagination.pageNumber, formatter), isLastPage };
};

export const fetchTransactionInfo = stubValue(stubTransactions[0]);
