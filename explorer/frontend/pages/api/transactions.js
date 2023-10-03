import { getTransactionInfoStub } from '../../stubs/transactions';
import config from '@/config';
import { ACCOUNT_STATE_CHANGE_ACTION, COSIGNATORY_MODIFICATION_ACTION, TRANSACTION_DIRECTION, TRANSACTION_TYPE } from '@/constants';
import { createAPISearchURL, createPage, createSearchCriteria } from '@/utils';

export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return;
	}

	const data = await getTransactionPage(req.query);

	res.status(200).json(data);
}

export const fetchTransactionPage = async searchCriteria => {
	const params = new URLSearchParams(searchCriteria).toString();
	const response = await fetch(`/api/transactions?${params}`);

	return response.json();
};

export const getTransactionPage = async (searchCriteria, filter = {}) => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);
	const url = createAPISearchURL(`${config.API_BASE_URL}/transactions`, { pageNumber, pageSize }, filter);
	const response = await fetch(url);
	const transactions = await response.json();

	return createPage(transactions, pageNumber, formatTransaction);
};

export const getTransactionInfo = async hash => {
	const response = await fetch(`${config.API_BASE_URL}/transaction/${hash}`);
	const transaction = await response.json();
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

	// let amount = null;

	// if (transactionInfo.body.length === 1 && transactionInfo.body[0].type === TRANSACTION_TYPE.TRANSFER) {
	// 	const nativeMosaic = transactionInfo.body[0].mosaics.find(mosaic => mosaic.id === config.NATIVE_MOSAIC_ID);
	// 	amount = nativeMosaic ? nativeMosaic.amount : null;
	// }

	return {
		...transactionInfo,
		accountStateChange
	};
};

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
		default:
			return formatBaseTransaction(data, address);
	}
};

const formatBaseTransaction = (data, address) => {
	const sender = data.fromAddress;
	const recipient = data.toAddress !== 'None' ? data.toAddress : null;
	const isOutgoing = sender === address;

	return {
		type: data.transactionType,
		group: 'confirmed',
		hash: data.transactionHash,
		timestamp: data.timestamp,
		sender,
		recipient,
		address: isOutgoing ? recipient : sender,
		direction: isOutgoing ? TRANSACTION_DIRECTION.OUTGOING : TRANSACTION_DIRECTION.INCOMING,
		size: 0,
		height: data.height,
		version: 0,
		signature: ' ',
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
			type: rawMessage.is_plain ? 'plain' : '',
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
	const rentalFee = data.value[0].sink_fee;
	const mosaicName = data.value[0].mosaic_namespace_name;

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
	const mosaicName = data.value[0].namespace_name;
	const { delta } = data.value[0];
	const supplyAction = data.value[0].supply_type;

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
	const rentalFee = data.value[0].sink_fee;
	const { namespace_name } = data.value[0];

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
					name: namespace_name,
					id: namespace_name
				},
				rentalFee
			}
		]
	};
};

const formatMultisigAccountModification = (data, address) => {
	const minCosignatories = data.value[0].min_cosignatories;
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
	const keyLinkAction = data.value[0].account_key_link_mode;

	return {
		...formatBaseTransaction(data, address),
		body: [
			{
				type: data.transactionType,
				sender: data.fromAddress,
				targetAccount: data.fromAddress,
				keyLinkAction
			}
		]
	};
};
