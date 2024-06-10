import config from '@/config';
import { ACCOUNT_STATE_CHANGE_ACTION, COSIGNATORY_MODIFICATION_ACTION, TRANSACTION_DIRECTION, TRANSACTION_TYPE } from '@/constants';
import { decodeTransactionMessage } from '@/utils/format';
import { createFetchInfoFunction, createSearchURL, createPage, createSearchCriteria, makeRequest } from '@/utils/server';

export const fetchTransactionPage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	const { filter } = searchCriteria;
	if (filter.address && filter.from) {
		filter.to = filter.address;
		delete filter.address;
	} else if (filter.address && filter.to) {
		filter.from = filter.address;
		delete filter.address;
	}
	if (filter.from) {
		filter.senderAddress = filter.from;
		delete filter.from;
	}
	if (filter.to) {
		filter.recipientAddress = filter.to;
		delete filter.to;
	}

	let url;
	if (filter.group === 'unconfirmed') {
		delete filter.group;
		url = createSearchURL(`${config.API_BASE_URL}/transactions/unconfirmed`, searchCriteria);
	} else {
		url = createSearchURL(`${config.API_BASE_URL}/transactions`, searchCriteria);
	}

	const transactions = await makeRequest(url);
	const formatter = data => formatTransaction(data, filter);

	return createPage(transactions, searchCriteria.pageNumber, formatter);
};

export const fetchTransactionInfo = createFetchInfoFunction(async hash => {
	const transaction = await makeRequest(`${config.API_BASE_URL}/transaction/${hash}`);
	const transactionInfo = formatTransaction(transaction);
	const accountsStateMap = {};
	const mosaicInfo = {};

	transactionInfo.body.forEach(transaction => {
		if (transaction.type !== TRANSACTION_TYPE.TRANSFER) {
			return;
		}

		const { sender, recipient } = transaction;
		if (!accountsStateMap[sender]) {
			accountsStateMap[sender] = {};
		}

		if (!accountsStateMap[recipient]) {
			accountsStateMap[recipient] = {};
		}

		transaction.mosaics.forEach(mosaic => {
			accountsStateMap[sender][mosaic.id] = (accountsStateMap[sender][mosaic.id] || 0) - mosaic.amount;
			accountsStateMap[recipient][mosaic.id] = (accountsStateMap[recipient][mosaic.id] || 0) + mosaic.amount;
			mosaicInfo[mosaic.id] = mosaic;
		});
	});

	const accountStateChange = [];

	Object.keys(accountsStateMap).forEach(address => {
		accountStateChange.push({
			address,
			action: Object.values(accountsStateMap[address]).map(amount =>
				amount > 0
					? ACCOUNT_STATE_CHANGE_ACTION.RECEIVE
					: amount < 0
					? ACCOUNT_STATE_CHANGE_ACTION.SEND
					: ACCOUNT_STATE_CHANGE_ACTION.NONE
			),
			mosaic: Object.keys(accountsStateMap[address]).map(mosaicId => ({
				...mosaicInfo[mosaicId],
				amount: accountsStateMap[address][mosaicId]
			}))
		});
	});

	return {
		...transactionInfo,
		accountStateChange
	};
});

const formatTransaction = (data, filter = {}) => {
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
	const recipient = data.toAddress !== 'None' ? data.toAddress : null;
	const isOutgoing = sender === address;
	const isIncoming = recipient === address;

	return {
		type: data.transactionType,
		group: group || 'confirmed',
		hash: data.transactionHash,
		timestamp: data.timestamp,
		deadline: data.deadline,
		signer: sender,
		sender,
		recipient,
		account: isOutgoing ? recipient : sender,
		direction: isOutgoing ? TRANSACTION_DIRECTION.OUTGOING : isIncoming ? TRANSACTION_DIRECTION.INCOMING : null,
		size: data.size || null,
		height: data.height || null,
		version: data.version || null,
		signature: data.signature || null,
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

const formatTransferTransaction = (data, filter) => {
	const { mosaic } = filter;
	const mosaics = data.value
		.filter(item => item.hasOwnProperty('amount') && item.hasOwnProperty('namespace'))
		.map(item => ({
			id: item.namespace,
			name: item.namespace,
			amount: item.amount
		}))
		.sort((x, y) => (x.id == mosaic ? -1 : y.id == mosaic ? 1 : 0));
	const nativeMosaicTransfer = mosaics.find(item => item.id === config.NATIVE_MOSAIC_ID);
	const rawMessage = data.value.find(item => item.hasOwnProperty('message'))?.message;
	const value = [...mosaics];
	let message = null;

	if (rawMessage?.payload) {
		message = {
			type: rawMessage.isPlain ? 'plain' : '',
			text: rawMessage.payload ? decodeTransactionMessage(rawMessage.payload) : null
		};
	}

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
				id: config.NATIVE_MOSAIC_ID,
				name: config.NATIVE_MOSAIC_ID,
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
				id: config.NATIVE_MOSAIC_ID,
				name: config.NATIVE_MOSAIC_ID,
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

	return {
		...formatBaseTransaction(data, filter),
		body: [
			{
				type: data.transactionType,
				sender: data.fromAddress,
				targetAccount: data.fromAddress,
				keyLinkAction,
				publicKey
			}
		]
	};
};

const formatMultisigTransaction = (data, filter) => {
	const rawEmbeddedTransaction = {
		...data,
		transactionType: data.embeddedTransactions[0].transactionType
	};
	if (rawEmbeddedTransaction.transactionType === TRANSACTION_TYPE.TRANSFER) {
		rawEmbeddedTransaction.value = [{ message: data.embeddedTransactions[0].message }, data.embeddedTransactions[0].mosaics];
	} else {
		rawEmbeddedTransaction.value = data.embeddedTransactions;
	}

	const formattedEmbeddedTransaction = formatTransaction(rawEmbeddedTransaction, filter.address);

	return {
		...formatBaseTransaction(data, filter),
		signatures: data.embeddedTransactions[0].signatures,
		signer: data.embeddedTransactions[0].initiator,
		amount: formattedEmbeddedTransaction.amount,
		value: formattedEmbeddedTransaction.value,
		body: formattedEmbeddedTransaction.body
	};
};
