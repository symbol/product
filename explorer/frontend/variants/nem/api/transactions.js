import { NEM_TRANSACTION_GROUP } from '../constants';
import { formatTransferMessage } from '../utils/transactions';
import config from '@/app/config';
import { ACCOUNT_STATE_CHANGE_ACTION, COSIGNATORY_MODIFICATION_ACTION, TRANSACTION_DIRECTION, TRANSACTION_TYPE } from '@/app/constants';
import { truncateDecimals } from '@/app/utils/common';
import {
	createApiUrl,
	createPage,
	createSearchCriteria,
	createSearchURL,
	createTryFetchInfoFunction,
	makeRequest
} from '@/app/utils/server';

/**
 * @typedef Page
 * @property {Array} data - the page data, an array of objects
 * @property {number} pageNumber The page number
 */

/**
 * Fetches the transaction page.
 * @param {object} searchParams - search parameters
 * @returns {Promise<Page>} transaction page
 */
export const fetchTransactionPage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	const { filter } = searchCriteria;
	const updatedFilter = { ...filter };
	if (updatedFilter.address && updatedFilter.from) {
		updatedFilter.to = updatedFilter.address;
		delete updatedFilter.address;
	} else if (updatedFilter.address && updatedFilter.to) {
		updatedFilter.from = updatedFilter.address;
		delete updatedFilter.address;
	}
	if (updatedFilter.from) {
		updatedFilter.senderAddress = updatedFilter.from;
		delete updatedFilter.from;
	}
	if (updatedFilter.to) {
		updatedFilter.recipientAddress = updatedFilter.to;
		delete updatedFilter.to;
	}
	if (updatedFilter.types) {
		updatedFilter.transactionTypes = updatedFilter.types;
		delete updatedFilter.types;
	}
	searchCriteria.filter = updatedFilter;

	let url;
	if (updatedFilter.group === NEM_TRANSACTION_GROUP.UNCONFIRMED) {
		delete updatedFilter.group;
		url = createSearchURL(createApiUrl('transactions/unconfirmed'), searchCriteria);
	} else {
		url = createSearchURL(createApiUrl('transactions'), searchCriteria);
	}

	const transactions = await makeRequest(url);
	const formatter = data => transactionFromDTO(data, filter);

	return createPage(transactions, searchCriteria.pageNumber, formatter);
};

/**
 * Fetches the transaction info.
 * @param {String} hash - requested transaction hash
 * @returns {Promise<Object>} transaction info
 */
export const fetchTransactionInfo = createTryFetchInfoFunction(async hash => {
	const transaction = await makeRequest(createApiUrl(`transaction/${hash}`));
	const transactionInfo = transactionFromDTO(transaction);
	const accountsStateMap = {};
	const mosaicInfo = {};

	transactionInfo.body.forEach(transaction => {
		if (transaction.type !== TRANSACTION_TYPE.TRANSFER)
			return;

		const { sender, recipient } = transaction;
		if (!accountsStateMap[sender])
			accountsStateMap[sender] = {};
		if (!accountsStateMap[recipient])
			accountsStateMap[recipient] = {};

		transaction.mosaics.forEach(mosaic => {
			accountsStateMap[sender][mosaic.id] = (accountsStateMap[sender][mosaic.id] || 0) - mosaic.amount;
			accountsStateMap[recipient][mosaic.id] = (accountsStateMap[recipient][mosaic.id] || 0) + mosaic.amount;
			mosaicInfo[mosaic.id] = mosaic;
		});
	});

    const { body } = transactionInfo;

	const accountStateChange = [];

	Object.keys(accountsStateMap).forEach(address => {
		accountStateChange.push({
			address,
			action: Object.values(accountsStateMap[address]).map(amount =>
				amount > 0
					? ACCOUNT_STATE_CHANGE_ACTION.RECEIVE
					: amount < 0
						? ACCOUNT_STATE_CHANGE_ACTION.SEND
						: ACCOUNT_STATE_CHANGE_ACTION.NONE),
			mosaic: Object.keys(accountsStateMap[address]).map(mosaicId => ({
				...mosaicInfo[mosaicId],
				amount: accountsStateMap[address][mosaicId]
			}))
		});
	});

	return {
		...transactionInfo,
		body,
		accountStateChange
	};
});

/**
 * Maps the transaction from the DTO.
 * @param {object} data - raw data from response
 * @param {object} filter - search filter
 * @returns {object} mapped transaction
 */
const transactionFromDTO = (data, filter = {}) => {
	switch (data.transactionType) {
	case TRANSACTION_TYPE.TRANSFER:
		return formatTransferTransaction(data, filter);
	case TRANSACTION_TYPE.MOSAIC_CREATION:
		return formatMosaicDefinition(data, filter);
	case TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE:
		return formatMosaicSupplyChange(data, filter);
	case TRANSACTION_TYPE.NAMESPACE_REGISTRATION:
		return formatNamespaceRegistration(data, filter);
	case TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION:
		return formatMultisigAccountModification(data, filter);
	case TRANSACTION_TYPE.ACCOUNT_KEY_LINK:
		return formatAccountKeyLink(data, filter);
	case TRANSACTION_TYPE.MULTISIG:
		return formatMultisigTransaction(data, filter);
	default:
		return formatBaseTransaction(data, filter);
	}
};

const formatBaseTransaction = (data, filter) => {
	const { address, group } = filter;
	const sender = data.fromAddress;
	const recipient = data.toAddress;
	const isOutgoing = sender === address;
	const isIncoming = recipient === address;

	return {
		type: data.transactionType,
		group: group || NEM_TRANSACTION_GROUP.CONFIRMED,
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
		body: [
			{
				type: data.transactionType,
				sender
			}
		]
	};
};

const extractTransferTransactionValue = value => {
	let message = null;
	const mosaics = value
		.filter(item => item.hasOwnProperty('amount') && item.hasOwnProperty('namespace'))
		.map(item => ({
			id: item.namespace,
			name: item.namespace,
			amount: item.amount
		}));

	const rawMessage = value.find(item => item.hasOwnProperty('message'))?.message;

	if (rawMessage?.payload)
		message = formatTransferMessage(rawMessage.type, rawMessage.payload);

	return {
		mosaics,
		message
	};
};

const formatTransferTransaction = (data, filter) => {
	const { mosaic } = filter;
	const { mosaics, message } = extractTransferTransactionValue(data.value);

	mosaics.sort((x, y) => (x.id == mosaic ? -1 : y.id == mosaic ? 1 : 0));

	const nativeMosaicTransfer = mosaics.find(item => item.id === config.PUBLIC_NATIVE_MOSAIC_ID);
	const value = [...mosaics];

	return {
		...formatBaseTransaction(data, filter),
		amount: nativeMosaicTransfer?.amount || 0,
		value,
		body: [
			{
				type: data.transactionType,
				sender: data.fromAddress,
				recipient: data.toAddress,
				mosaics,
				message
			}
		]
	};
};

const formatMosaicDefinition = (data, filter) => {
	const rentalFee = data.value[0].sinkFee;
	const mosaicName = data.value[0].mosaicNamespaceName;

	return {
		...formatBaseTransaction(data, filter),
		amount: rentalFee,
		value: [
			{
				id: config.PUBLIC_NATIVE_MOSAIC_ID,
				name: config.PUBLIC_NATIVE_MOSAIC_ID,
				amount: rentalFee
			}
		],
		body: [
			{
				type: data.transactionType,
				sender: data.fromAddress,
				recipient: data.toAddress,
				mosaic: {
					name: mosaicName,
					id: mosaicName
				},
				rentalFee
			}
		]
	};
};

const formatMosaicSupplyChange = (data, filter) => {
	const mosaicName = data.value[0].namespaceName;
	const { delta } = data.value[0];
	const supplyAction = data.value[0].supplyType;

	return {
		...formatBaseTransaction(data, filter),
		body: [
			{
				type: data.transactionType,
				sender: data.fromAddress,
				targetMosaic: {
					name: mosaicName,
					id: mosaicName
				},
				delta,
				supplyAction
			}
		]
	};
};

const formatNamespaceRegistration = (data, filter) => {
	const rentalFee = data.value[0].sinkFee;
	const { namespaceName } = data.value[0];

	return {
		...formatBaseTransaction(data, filter),
		value: [
			{
				id: config.PUBLIC_NATIVE_MOSAIC_ID,
				name: config.PUBLIC_NATIVE_MOSAIC_ID,
				amount: rentalFee
			}
		],
		amount: rentalFee,
		body: [
			{
				type: data.transactionType,
				sender: data.fromAddress,
				recipient: data.toAddress,
				namespace: {
					name: namespaceName,
					id: namespaceName
				},
				rentalFee
			}
		]
	};
};

const formatMultisigAccountModification = (data, filter) => {
	const { minCosignatories } = data.value[0];
	const { modifications } = data.value[0];
	const cosignatoryAdditions = modifications
		.filter(item => item.modificationType === COSIGNATORY_MODIFICATION_ACTION.ADDITION)
		.map(item => item.cosignatoryAccount);
	const cosignatoryDeletions = modifications
		.filter(item => item.modificationType === COSIGNATORY_MODIFICATION_ACTION.REMOVAL)
		.map(item => item.cosignatoryAccount);

	return {
		...formatBaseTransaction(data, filter),
		body: [
			{
				type: data.transactionType,
				sender: data.fromAddress,
				targetAccount: data.fromAddress,
				cosignatoryAdditions,
				cosignatoryDeletions,
				minCosignatories
			}
		]
	};
};

const formatAccountKeyLink = (data, filter) => {
	const keyLinkAction = data.value[0].mode;
	const publicKey = data.value[0].remoteAccount;
	const remoteAccount = data.value[0].remoteAddress || null;

	return {
		...formatBaseTransaction(data, filter),
		body: [
			{
				type: data.transactionType,
				sender: data.fromAddress,
				targetAccount: data.fromAddress,
				keyLinkAction,
				publicKey,
				...(remoteAccount ? { remoteAccount } : {})
			}
		]
	};
};

const formatMultisigTransaction = (data, filter) => {
	const embeddedTransaction = data.embeddedTransactions[0];
	const flatEmbeddedTransaction = {
		...data,
		...embeddedTransaction
	};
	if (flatEmbeddedTransaction.transactionType === TRANSACTION_TYPE.TRANSFER) {
		const { mosaics, message } = extractTransferTransactionValue(embeddedTransaction.value);

		flatEmbeddedTransaction.value = embeddedTransaction.value || [{ message: message }, ...mosaics];
	}

	const formattedTransaction = formatBaseTransaction(data, filter);
	const formattedEmbeddedTransaction = transactionFromDTO(flatEmbeddedTransaction, filter);

	// Fees breakdown
	const multisigFee = truncateDecimals(formattedTransaction.fee, config.PUBLIC_NATIVE_MOSAIC_DIVISIBILITY);
	const embeddedTransactionsFee = truncateDecimals(formattedEmbeddedTransaction.fee, config.PUBLIC_NATIVE_MOSAIC_DIVISIBILITY);
	const signaturesFee = truncateDecimals(
		embeddedTransaction.signatures.reduce((total, signature) => total + signature.fee, 0),
		config.PUBLIC_NATIVE_MOSAIC_DIVISIBILITY
	);
	const feesBreakdownData = {
		multisigFee,
		embeddedTransactionsFee,
		signaturesFee,
		totalFee: truncateDecimals(
			(signaturesFee + multisigFee + embeddedTransactionsFee).toPrecision(config.PUBLIC_NATIVE_MOSAIC_DIVISIBILITY),
			config.PUBLIC_NATIVE_MOSAIC_DIVISIBILITY
		)
	};
	const feesBreakdown = Object.entries(feesBreakdownData).map(([key, value]) => ({
		type: key,
		amount: value
	}));

	return {
		...formattedTransaction,
		signatures: embeddedTransaction.signatures,
		signer: embeddedTransaction.initiator,
		amount: formattedEmbeddedTransaction.amount,
		value: formattedEmbeddedTransaction.value,
		body: formattedEmbeddedTransaction.body,
		fee: feesBreakdownData.totalFee,
		feesBreakdown
	};
};
