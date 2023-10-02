import { getTransactionInfoStub, getTransactionsStub } from '../../stubs/transactions';
import config from '@/config';
import { ACCOUNT_STATE_CHANGE_ACTION, TRANSACTION_TYPE } from '@/constants';
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
	const transactionInfo = await getTransactionInfoStub(hash);
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

	let amount = null;

	if (transactionInfo.body.length === 1 && transactionInfo.body[0].type === TRANSACTION_TYPE.TRANSFER) {
		const nativeMosaic = transactionInfo.body[0].mosaics.find(mosaic => mosaic.id === config.NATIVE_MOSAIC_ID);
		amount = nativeMosaic ? nativeMosaic.amount : null;
	}

	return {
		...transactionInfo,
		accountStateChange,
		amount
	};
};

const formatTransaction = data => {
	const nativeMosaicTransfer = data.value.find(item => item.namespace === 'nem.xem');

	return {
		type: data.transactionType,
		group: 'confirmed',
		hash: data.transactionHash,
		timestamp: data.timestamp,
		signer: data.fromAddress,
		recipient: data.toAddress !== 'None' ? data.toAddress : null,
		size: 0,
		height: data.height,
		version: 0,
		signature: ' ',
		fee: data.fee,
		amount: nativeMosaicTransfer ? nativeMosaicTransfer.amount : 0
	};
};
