import {
	absoluteToRelative,
	createSymbolNodePath,
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

const transactionTypeMap = {};
const setTransactionType = (type, transactionType) => {
	transactionTypeMap[type] = transactionType;
};
setTransactionType(16716, TRANSACTION_TYPE.ACCOUNT_KEY_LINK);
setTransactionType(16963, TRANSACTION_TYPE.VRF_KEY_LINK);
setTransactionType(16707, TRANSACTION_TYPE.VOTING_KEY_LINK);
setTransactionType(16972, TRANSACTION_TYPE.NODE_KEY_LINK);
setTransactionType(16705, TRANSACTION_TYPE.AGGREGATE_COMPLETE);
setTransactionType(16961, TRANSACTION_TYPE.AGGREGATE_BONDED);
setTransactionType(16717, TRANSACTION_TYPE.MOSAIC_CREATION);
setTransactionType(16973, TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE);
setTransactionType(17229, TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION);
setTransactionType(16718, TRANSACTION_TYPE.NAMESPACE_REGISTRATION);
setTransactionType(16974, TRANSACTION_TYPE.ADDRESS_ALIAS);
setTransactionType(17230, TRANSACTION_TYPE.MOSAIC_ALIAS);
setTransactionType(16708, TRANSACTION_TYPE.ACCOUNT_METADATA);
setTransactionType(16964, TRANSACTION_TYPE.MOSAIC_METADATA);
setTransactionType(17220, TRANSACTION_TYPE.NAMESPACE_METADATA);
setTransactionType(16725, TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION);
setTransactionType(16712, TRANSACTION_TYPE.HASH_LOCK);
setTransactionType(16722, TRANSACTION_TYPE.SECRET_LOCK);
setTransactionType(16978, TRANSACTION_TYPE.SECRET_PROOF);
setTransactionType(16720, TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION);
setTransactionType(16976, TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION);
setTransactionType(17232, TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION);
setTransactionType(16721, TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION);
setTransactionType(16977, TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION);
setTransactionType(16724, TRANSACTION_TYPE.TRANSFER);

const supportedSearchParamNames = new Set(['address', 'group', 'height', 'order', 'pageNumber', 'pageSize']);

const hasUnsupportedSearchParams = (searchParams = {}) =>
	Object.keys(searchParams).some(key => !supportedSearchParamNames.has(key));

const pickSearchParams = (searchParams = {}) => {
	const { address, height, order, pageNumber, pageSize } = searchParams;

	return {
		...(address && { address }),
		...(height && { height }),
		...(order && { order }),
		...(pageNumber && { pageNumber }),
		...(pageSize && { pageSize })
	};
};

const emptyPage = searchParams => ({
	data: [],
	pageNumber: Number(searchParams?.pageNumber || 1)
});

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
	const timestamp = meta.timestamp ?? transaction.timestamp;

	return {
		hash: meta.hash,
		height: Number(meta.height || 0),
		type: transactionTypeMap[transaction.type] || transaction.type,
		signer: transaction.signerAddress
			? hexToSymbolAddress(transaction.signerAddress)
			: publicKeyToSymbolAddress(transaction.signerPublicKey),
		sender: transaction.signerAddress
			? hexToSymbolAddress(transaction.signerAddress)
			: publicKeyToSymbolAddress(transaction.signerPublicKey),
		recipient: transaction.recipientAddress ? hexToSymbolAddress(transaction.recipientAddress) : null,
		value,
		amount: nativeTransfer?.amount || 0,
		fee: absoluteToRelative(transaction.maxFee || 0),
		timestamp: timestamp ? symbolTimestampToDate(timestamp) : null,
		message: transaction.message || ''
	};
};

export const fetchTransactionPage = async searchParams => {
	if (hasUnsupportedSearchParams(searchParams))
		return emptyPage(searchParams);

	const path = searchParams?.group === 'unconfirmed' ? 'transactions/unconfirmed' : 'transactions/confirmed';
	const url = createSymbolSearchURL(path, pickSearchParams(searchParams), { orderBy: 'id' });
	const response = await fetchSymbolNode(createSymbolNodePath(url));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, transactionInfoFromDTO);
};

export const fetchTransactionInfo = createTryFetchInfoFunction(async hash => {
	const transaction = await fetchSymbolNode(`transactions/confirmed/${hash}`);

	return transactionInfoFromDTO(transaction);
});

export const resolveTransactionBlockSearch = async () => null;
export const resolveTransactionMosaicSearch = async () => null;
export const resolveTransactionRecipientSearch = async () => null;
export const resolveTransactionSignerSearch = async () => null;
