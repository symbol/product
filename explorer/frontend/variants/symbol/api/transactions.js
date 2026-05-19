import {
	absoluteToRelative,
	createSymbolPage,
	createSymbolSearchURL,
	fetchSymbolNode,
	hexToSymbolAddress,
	publicKeyToSymbolAddress,
	symbolTimestampToDate
} from '../utils';
import config from '@/config';
import { TRANSACTION_TYPE } from '@/constants';
import { createTryFetchInfoFunction } from '@/utils/server';

const transactionTypeMap = {
	16724: TRANSACTION_TYPE.TRANSFER,
	16717: TRANSACTION_TYPE.NAMESPACE_REGISTRATION,
	16718: TRANSACTION_TYPE.MOSAIC_CREATION,
	16973: TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE,
	16705: TRANSACTION_TYPE.ACCOUNT_KEY_LINK
};

const mosaicFromDTO = mosaic => {
	const id = mosaic.id || config.NATIVE_MOSAIC_ID;

	return {
		id,
		name: id === config.NATIVE_MOSAIC_ID ? config.NATIVE_MOSAIC_TICKER : id,
		amount: absoluteToRelative(mosaic.amount || 0)
	};
};

const transactionInfoFromDTO = data => {
	const transaction = data.transaction || {};
	const meta = data.meta || {};
	const value = (transaction.mosaics || []).map(mosaicFromDTO);
	const nativeTransfer = value.find(item => item.id === config.NATIVE_MOSAIC_ID);

	return {
		hash: meta.hash,
		height: Number(meta.height || 0),
		type: transactionTypeMap[transaction.type] || transaction.type,
		sender: transaction.signerAddress
			? hexToSymbolAddress(transaction.signerAddress)
			: publicKeyToSymbolAddress(transaction.signerPublicKey),
		recipient: transaction.recipientAddress ? hexToSymbolAddress(transaction.recipientAddress) : null,
		value,
		amount: nativeTransfer?.amount || 0,
		fee: absoluteToRelative(transaction.maxFee || 0),
		timestamp: symbolTimestampToDate(transaction.deadline || 0),
		message: transaction.message || ''
	};
};

export const fetchTransactionPage = async searchParams => {
	const path = searchParams?.group === 'unconfirmed' ? 'transactions/unconfirmed' : 'transactions/confirmed';
	const filter = { ...(searchParams || {}) };
	delete filter.group;
	const url = createSymbolSearchURL(path, filter, { orderBy: 'id' });
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, transactionInfoFromDTO);
};

export const fetchTransactionInfo = createTryFetchInfoFunction(async hash => {
	const transaction = await fetchSymbolNode(`transactions/confirmed/${hash}`);

	return transactionInfoFromDTO(transaction);
});
