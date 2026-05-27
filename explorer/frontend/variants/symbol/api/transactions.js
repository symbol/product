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

const transactionTypeMap = {
	16716: TRANSACTION_TYPE.ACCOUNT_KEY_LINK,
	16963: TRANSACTION_TYPE.VRF_KEY_LINK,
	16707: TRANSACTION_TYPE.VOTING_KEY_LINK,
	16972: TRANSACTION_TYPE.NODE_KEY_LINK,
	16705: TRANSACTION_TYPE.AGGREGATE_COMPLETE,
	16961: TRANSACTION_TYPE.AGGREGATE_BONDED,
	16717: TRANSACTION_TYPE.MOSAIC_CREATION,
	16973: TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE,
	17229: TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION,
	16718: TRANSACTION_TYPE.NAMESPACE_REGISTRATION,
	16974: TRANSACTION_TYPE.ADDRESS_ALIAS,
	17230: TRANSACTION_TYPE.MOSAIC_ALIAS,
	16708: TRANSACTION_TYPE.ACCOUNT_METADATA,
	16964: TRANSACTION_TYPE.MOSAIC_METADATA,
	17220: TRANSACTION_TYPE.NAMESPACE_METADATA,
	16725: TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION,
	16712: TRANSACTION_TYPE.HASH_LOCK,
	16722: TRANSACTION_TYPE.SECRET_LOCK,
	16978: TRANSACTION_TYPE.SECRET_PROOF,
	16720: TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION,
	16976: TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION,
	17232: TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION,
	16721: TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION,
	16977: TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION,
	16724: TRANSACTION_TYPE.TRANSFER
};

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
