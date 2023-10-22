import config from '@/config';
import { ACCOUNT_STATE_CHANGE_ACTION, COSIGNATORY_MODIFICATION_ACTION, TRANSACTION_DIRECTION, TRANSACTION_TYPE } from '@/constants';
import { createAPICallFunction, createAPISearchURL, createPage, createSearchCriteria, makeRequest } from '@/utils';

export const fetchTransactionPage = async searchCriteria => {
	const { pageNumber, pageSize, filter } = createSearchCriteria(searchCriteria);
	const formattedFilter = { ...filter };
	if (formattedFilter.address && formattedFilter.from) {
		formattedFilter.to = formattedFilter.address;
		delete formattedFilter.address;
	} else if (formattedFilter.address && formattedFilter.to) {
		formattedFilter.from = formattedFilter.address;
		delete formattedFilter.address;
	}
	if (formattedFilter.from) {
		formattedFilter.senderAddress = formattedFilter.from;
		delete formattedFilter.from;
	}
	if (formattedFilter.to) {
		formattedFilter.recipientAddress = formattedFilter.to;
		delete formattedFilter.to;
	}
	const url = createAPISearchURL(`${config.API_BASE_URL}/transactions`, { pageNumber, pageSize }, formattedFilter);

	// TODO: remove try-catch section.
	let transactions;
	try {
		transactions = await makeRequest(url);
	} catch {
		transactions = [];
	}

	const formatter = formattedFilter.address ? data => formatTransaction(data, formattedFilter.address) : formatTransaction;

	return createPage(transactions, pageNumber, formatter);
};

export const fetchTransactionInfo = createAPICallFunction(async hash => {
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

const formatTransaction = (data, address) => {
	switch (data.transactionType) {
		case TRANSACTION_TYPE.TRANSFER:
			return formatTransferTransaction(data, address);
		case TRANSACTION_TYPE.MOSAIC_CREATION:
			return formatMosaicDefinition(data, address);
		case TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE:
			return formatMosaicSupplyChange(data, address);
		case TRANSACTION_TYPE.NAMESPACE_REGISTRATION:
			return formatNamespaceRegistration(data, address);
		case TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION:
			return formatMultisigAccountModification(data, address);
		case TRANSACTION_TYPE.ACCOUNT_KEY_LINK:
			return formatAccountKeyLink(data, address);
		case TRANSACTION_TYPE.MULTISIG:
			return formatMultisigTransaction(data, address);
		default:
			return formatBaseTransaction(data, address);
	}
};

const formatBaseTransaction = (data, address) => {
	const sender = data.fromAddress;
	const recipient = data.toAddress !== 'None' ? data.toAddress : null;
	const isOutgoing = sender === address;
	const isIncoming = recipient === address;

	return {
		type: data.transactionType,
		group: 'confirmed',
		hash: data.transactionHash,
		timestamp: data.timestamp,
		signer: sender,
		sender,
		recipient,
		account: isOutgoing ? recipient : sender,
		direction: isOutgoing ? TRANSACTION_DIRECTION.OUTGOING : isIncoming ? TRANSACTION_DIRECTION.INCOMING : null,
		size: '-',
		height: data.height,
		version: '-',
		signature: '-',
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

const formatTransferTransaction = (data, address) => {
	const mosaics = data.value
		.filter(item => item.hasOwnProperty('amount') && item.hasOwnProperty('namespace'))
		.map(item => ({
			id: item.namespace,
			name: item.namespace,
			amount: item.amount
		}));
	const nativeMosaicTransfer = mosaics.find(item => item.id === config.NATIVE_MOSAIC_ID);
	const rawMessage = data.value.find(item => item.hasOwnProperty('message'))?.message;
	const value = [...mosaics];
	let message = null;

	if (rawMessage?.payload) {
		message = {
			type: rawMessage.isPlain ? 'plain' : '',
			text: rawMessage.payload ? rawMessage.payload : null
		};
	}

	return {
		...formatBaseTransaction(data, address),
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

const formatMosaicDefinition = (data, address) => {
	const rentalFee = data.value[0].sinkFee;
	const mosaicName = data.value[0].mosaicNamespaceName;

	return {
		...formatBaseTransaction(data, address),
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

const formatMosaicSupplyChange = (data, address) => {
	const mosaicName = data.value[0].namespaceName;
	const { delta } = data.value[0];
	const supplyAction = data.value[0].supplyType;

	return {
		...formatBaseTransaction(data, address),
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

const formatNamespaceRegistration = (data, address) => {
	const rentalFee = data.value[0].sinkFee;
	const { namespaceName } = data.value[0];

	return {
		...formatBaseTransaction(data, address),
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

const formatMultisigAccountModification = (data, address) => {
	const { minCosignatories } = data.value[0];
	const { modifications } = data.value[0];
	const cosignatoryAdditions = modifications
		.filter(item => item.modification_type === COSIGNATORY_MODIFICATION_ACTION.ADDITION)
		.map(item => item.cosignatory_account);
	const cosignatoryDeletions = modifications
		.filter(item => item.modification_type === COSIGNATORY_MODIFICATION_ACTION.REMOVAL)
		.map(item => item.cosignatory_account);

	return {
		...formatBaseTransaction(data, address),
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

const formatAccountKeyLink = (data, address) => {
	const keyLinkAction = data.value[0].mode;
	const publicKey = data.value[0].remoteAccount;

	return {
		...formatBaseTransaction(data, address),
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

const formatMultisigTransaction = (data, address) => {
	const rawEmbeddedTransaction = {
		...data,
		transactionType: data.embeddedTransactions[0].transactionType
	};
	if (rawEmbeddedTransaction.transactionType === TRANSACTION_TYPE.TRANSFER) {
		rawEmbeddedTransaction.value = [{ message: data.embeddedTransactions[0].message }, data.embeddedTransactions[0].mosaics];
	} else {
		rawEmbeddedTransaction.value = data.embeddedTransactions;
	}

	const formattedEmbeddedTransaction = formatTransaction(rawEmbeddedTransaction, address);

	return {
		...formatBaseTransaction(data, address),
		signatures: data.embeddedTransactions[0].signatures,
		signer: data.embeddedTransactions[0].initiator,
		amount: formattedEmbeddedTransaction.amount,
		value: formattedEmbeddedTransaction.value,
		body: formattedEmbeddedTransaction.body
	};
};
