import { SYMBOL_MESSAGE_TYPE, SYMBOL_TRANSACTION_GROUP } from '../constants';
import { TRANSACTION_TYPE } from '../transaction/transaction-types';
import config from '@/app/config';
import { ACCOUNT_STATE_CHANGE_ACTION, TRANSACTION_DIRECTION } from '@/app/constants';
import {
	createApiUrl,
	createPage,
	createSearchCriteria,
	createSearchURL,
	createTryFetchInfoFunction,
	makeRequest
} from '@/app/utils/server';

/** @typedef {import('../types/Transaction').AccountStateChange} AccountStateChange */
/** @typedef {import('../types/Transaction').Page} Page */
/** @typedef {import('../types/Transaction').TransactionBodyItem} TransactionBodyItem */
/** @typedef {import('../types/Transaction').TransactionInfo} TransactionInfo */
/** @typedef {import('../types/Transaction').TransactionListItem} TransactionListItem */

const EMPTY_MOSAIC_ID = '0000000000000000';
const MAX_MOSAIC_DIVISIBILITY = 6;

const SUPPLY_CHANGE_ACTION = {
	INCREASE: 'increase',
	DECREASE: 'decrease'
};

// Filters that also match the embedded transactions.
const embeddedTransactionFilterNames = [
	'transactionTypes',
	'recipientAddress',
	'mosaic'
];

const accountStateChangeTransactionTypes = [TRANSACTION_TYPE.TRANSFER, TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION];

/**
 * Fetches the transaction page.
 * @param {object} [searchParams] - Search parameters.
 * @returns {Promise<Page>} The page of transactions.
 */
export const fetchTransactionPage = async searchParams => {
	const { filter, pageNumber, pageSize } = createSearchCriteria(searchParams);

	if (filter.group === SYMBOL_TRANSACTION_GROUP.UNCONFIRMED)
		return fetchUnconfirmedTransactionPage(pageNumber, pageSize);

	const searchCriteria = {
		pageNumber,
		pageSize,
		filter: createTransactionFilter(filter)
	};
	const transactionDTOs = await makeRequest(createSearchURL(createApiUrl('transactions'), searchCriteria));

	return createPage(transactionDTOs, pageNumber, transactionDTO => transactionListItemFromDTO(transactionDTO, filter.address));
};

/**
 * Fetches transaction info by hash.
 * @param {string} hash - Requested transaction hash.
 * @returns {Promise<TransactionInfo|null>} The transaction info, null when the transaction is not found.
 */
export const fetchTransactionInfo = createTryFetchInfoFunction(async hash => {
	const transactionDTO = await makeRequest(createApiUrl(`transaction/${hash}`));

	return transactionInfoFromDTO(transactionDTO);
});

/**
 * Fetches all unconfirmed transactions and cuts the requested page out of them.
 * @param {number} pageNumber - The page number.
 * @param {number} pageSize - The page size.
 * @returns {Promise<Page>} The page of unconfirmed transactions.
 */
const fetchUnconfirmedTransactionPage = async (pageNumber, pageSize) => {
	const transactionDTOs = await makeRequest(createApiUrl('transactions/unconfirmed'));
	const offset = pageSize * (pageNumber - 1);
	const pageTransactionDTOs = transactionDTOs.slice(offset, offset + pageSize);

	return createPage(pageTransactionDTOs, pageNumber, unconfirmedTransactionListItemFromDTO);
};

const isValueSet = value => value !== undefined && value !== null && value !== '';

/**
 * Creates the address part of the request filter. With an account address, "from" and "to" select
 * the transactions between that account and the other one.
 * @param {object} filter - Search filter.
 * @returns {object} The address filter.
 */
const createAddressFilter = ({ address, from, to }) => {
	if (address && from)
		return { senderAddress: from, recipientAddress: address };

	if (address && to)
		return { senderAddress: address, recipientAddress: to };

	return {
		address,
		senderAddress: from,
		recipientAddress: to
	};
};

/**
 * Creates the request filter from the search filter. Keeps only the supported filters with a value
 * and includes the embedded transactions when a filter can match them.
 * @param {object} filter - Search filter.
 * @returns {object} The request filter.
 */
const createTransactionFilter = filter => {
	const transactionFilter = {
		...createAddressFilter(filter),
		transactionTypes: filter.types,
		mosaic: filter.mosaic,
		height: filter.height
	};

	if (embeddedTransactionFilterNames.some(filterName => isValueSet(transactionFilter[filterName])))
		transactionFilter.embedded = true;

	return Object.fromEntries(Object.entries(transactionFilter).filter(([, value]) => isValueSet(value)));
};

/**
 * Gets the transaction direction for the account.
 * @param {string} sender - The sender address.
 * @param {string|null} recipient - The recipient address.
 * @param {string} [address] - The requested account address.
 * @returns {'incoming'|'outgoing'|null} The transaction direction, null when the account is not the sender or the recipient.
 */
const getTransactionDirection = (sender, recipient, address) => {
	if (sender === address)
		return TRANSACTION_DIRECTION.OUTGOING;

	if (recipient === address)
		return TRANSACTION_DIRECTION.INCOMING;

	return null;
};

/**
 * Converts a transaction DTO to a transaction list item.
 * @param {object} transactionDTO - The transaction DTO to convert.
 * @param {string} [address] - The requested account address, used to derive the direction.
 * @returns {TransactionListItem} The transaction list item.
 */
const transactionListItemFromDTO = (transactionDTO, address) => {
	const { sender, recipient } = transactionDTO;
	const direction = getTransactionDirection(sender, recipient, address);

	return {
		type: transactionDTO.type,
		group: transactionDTO.group,
		hash: transactionDTO.hash ?? transactionDTO.aggregateHash,
		timestamp: transactionDTO.timestamp,
		signer: transactionDTO.signer,
		sender,
		recipient,
		account: direction === TRANSACTION_DIRECTION.OUTGOING ? recipient : sender,
		direction,
		height: transactionDTO.height,
		fee: transactionDTO.fee,
		amount: transactionDTO.amount,
		value: transactionDTO.value
	};
};

/**
 * Converts an unconfirmed transaction DTO to a transaction list item. Only a transfer carries mosaics.
 * @param {object} transactionDTO - The unconfirmed transaction DTO to convert.
 * @returns {TransactionListItem} The transaction list item.
 */
const unconfirmedTransactionListItemFromDTO = transactionDTO => {
	const isTransfer = transactionDTO.transactionType === TRANSACTION_TYPE.TRANSFER;
	const mosaics = isTransfer ? transactionDTO.value.filter(item => !item.message) : [];
	const nativeMosaic = mosaics.find(mosaic => mosaic.id === config.PUBLIC_NATIVE_MOSAIC_ID);

	return {
		type: transactionDTO.transactionType,
		group: SYMBOL_TRANSACTION_GROUP.UNCONFIRMED,
		hash: transactionDTO.transactionHash,
		timestamp: transactionDTO.timestamp,
		signer: transactionDTO.fromAddress,
		sender: transactionDTO.fromAddress,
		recipient: transactionDTO.toAddress,
		account: transactionDTO.fromAddress,
		direction: null,
		height: transactionDTO.height || null,
		fee: transactionDTO.fee,
		amount: nativeMosaic?.amount ?? 0,
		value: mosaics
	};
};

/**
 * Converts a transaction details DTO to a transaction info object.
 * @param {object} transactionDTO - The transaction details DTO to convert.
 * @returns {TransactionInfo} The transaction info object.
 */
const transactionInfoFromDTO = transactionDTO => {
	const { info, aggregate } = transactionDTO;
	const body = transactionDTO.graphic.transactions.map(transactionBodyItemFromDTO);

	return {
		type: transactionDTO.type,
		group: transactionDTO.group,
		hash: transactionDTO.hash,
		timestamp: info.timestamp,
		deadline: info.deadline,
		signer: info.sender,
		sender: info.sender,
		recipient: info.recipient,
		height: info.height,
		signature: info.signature,
		fee: info.fee ?? info.maxFee,
		amount: info.amount ?? 0,
		value: info.value ?? [],
		body,
		size: info.size,
		version: transactionDTO.version,
		signatures: aggregate?.cosignatures ?? [],
		accountStateChange: createAccountStateChange(body)
	};
};

const formatTransferMessage = message => {
	if (!message)
		return null;

	return {
		type: message.type ?? SYMBOL_MESSAGE_TYPE.RAW,
		text: message.text
	};
};

/**
 * Converts a body item DTO to a body item with the fields of its transaction type.
 * @param {object} bodyItemDTO - The body item DTO to convert.
 * @returns {TransactionBodyItem} The body item.
 */
const transactionBodyItemFromDTO = bodyItemDTO => {
	const { type, sender, recipient, detail } = bodyItemDTO;
	const bodyItem = {
		type,
		sender,
		recipient,
		...detail
	};

	switch (type) {
	case TRANSACTION_TYPE.TRANSFER:
		return {
			...bodyItem,
			message: formatTransferMessage(bodyItem.message)
		};
	case TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE: {
		const { action, delta, ...supplyChange } = bodyItem;
		const isDecrease = action === SUPPLY_CHANGE_ACTION.DECREASE;

		return {
			...supplyChange,
			delta: isDecrease ? -Number(delta) : Number(delta)
		};
	}
	case TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION:
		return {
			...bodyItem,
			referenceMosaicId: bodyItem.referenceMosaicId === EMPTY_MOSAIC_ID ? null : bodyItem.referenceMosaicId
		};
	default:
		return bodyItem;
	}
};

const getAccountStateChangeAction = amount => {
	if (amount > 0)
		return ACCOUNT_STATE_CHANGE_ACTION.RECEIVE;

	if (amount < 0)
		return ACCOUNT_STATE_CHANGE_ACTION.SEND;

	return ACCOUNT_STATE_CHANGE_ACTION.NONE;
};

const addAccountMosaicAmount = (accountMosaicAmounts, address, mosaicId, amount) => {
	const mosaicAmounts = accountMosaicAmounts[address] ?? {};

	mosaicAmounts[mosaicId] = (mosaicAmounts[mosaicId] ?? 0) + amount;
	accountMosaicAmounts[address] = mosaicAmounts;
};

/**
 * Creates the account state change list from the body items. Sums the mosaics each account sends
 * and receives in the transactions that move mosaics between two accounts.
 * @param {TransactionBodyItem[]} body - The transaction body items.
 * @returns {AccountStateChange[]} The account state change list.
 */
const createAccountStateChange = body => {
	const accountMosaicAmounts = {};
	const mosaicInfos = {};
	const mosaicMoves = body
		.filter(transaction => accountStateChangeTransactionTypes.includes(transaction.type))
		.flatMap(({ sender, recipient, mosaics }) => mosaics.map(mosaic => ({
			sender,
			recipient,
			mosaic
		})));

	mosaicMoves.forEach(({ sender, recipient, mosaic }) => {
		addAccountMosaicAmount(accountMosaicAmounts, sender, mosaic.id, -mosaic.amount);
		addAccountMosaicAmount(accountMosaicAmounts, recipient, mosaic.id, mosaic.amount);
		mosaicInfos[mosaic.id] = mosaic;
	});

	return Object.entries(accountMosaicAmounts).map(([address, mosaicAmounts]) => {
		const mosaics = Object.entries(mosaicAmounts).map(([mosaicId, amount]) => ({
			...mosaicInfos[mosaicId],
			amount: Number(amount.toFixed(MAX_MOSAIC_DIVISIBILITY))
		}));

		return {
			address,
			action: mosaics.map(mosaic => getAccountStateChangeAction(mosaic.amount)),
			mosaic: mosaics
		};
	});
};
