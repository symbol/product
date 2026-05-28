import { absoluteToRelative, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';

export const BLOCK_RECEIPT_GROUP = {
	BALANCE_CHANGE: 'balanceChange',
	BALANCE_TRANSFER: 'balanceTransfer',
	ARTIFACT_EXPIRY: 'artifactExpiry',
	INFLATION: 'inflation'
};

export const BLOCK_RECEIPT_TYPE = {
	HARVEST_FEE: 8515,
	LOCK_HASH_CREATED: 12616,
	LOCK_HASH_COMPLETED: 8776,
	LOCK_HASH_EXPIRED: 9032,
	LOCK_SECRET_CREATED: 12626,
	LOCK_SECRET_COMPLETED: 8786,
	LOCK_SECRET_EXPIRED: 9042,
	MOSAIC_RENTAL_FEE: 4685,
	NAMESPACE_RENTAL_FEE: 4942,
	MOSAIC_EXPIRED: 16717,
	NAMESPACE_EXPIRED: 16718,
	NAMESPACE_DELETED: 16974,
	INFLATION: 20803
};

const receiptTypeNames = {
	[BLOCK_RECEIPT_TYPE.HARVEST_FEE]: 'harvestFee',
	[BLOCK_RECEIPT_TYPE.LOCK_HASH_CREATED]: 'lockHashCreated',
	[BLOCK_RECEIPT_TYPE.LOCK_HASH_COMPLETED]: 'lockHashCompleted',
	[BLOCK_RECEIPT_TYPE.LOCK_HASH_EXPIRED]: 'lockHashExpired',
	[BLOCK_RECEIPT_TYPE.LOCK_SECRET_CREATED]: 'lockSecretCreated',
	[BLOCK_RECEIPT_TYPE.LOCK_SECRET_COMPLETED]: 'lockSecretCompleted',
	[BLOCK_RECEIPT_TYPE.LOCK_SECRET_EXPIRED]: 'lockSecretExpired',
	[BLOCK_RECEIPT_TYPE.MOSAIC_RENTAL_FEE]: 'mosaicRentalFee',
	[BLOCK_RECEIPT_TYPE.NAMESPACE_RENTAL_FEE]: 'namespaceRentalFee',
	[BLOCK_RECEIPT_TYPE.MOSAIC_EXPIRED]: 'mosaicExpired',
	[BLOCK_RECEIPT_TYPE.NAMESPACE_EXPIRED]: 'namespaceExpired',
	[BLOCK_RECEIPT_TYPE.NAMESPACE_DELETED]: 'namespaceDeleted',
	[BLOCK_RECEIPT_TYPE.INFLATION]: 'inflation'
};

const receiptGroupMap = {
	[BLOCK_RECEIPT_TYPE.HARVEST_FEE]: BLOCK_RECEIPT_GROUP.BALANCE_CHANGE,
	[BLOCK_RECEIPT_TYPE.LOCK_HASH_CREATED]: BLOCK_RECEIPT_GROUP.BALANCE_CHANGE,
	[BLOCK_RECEIPT_TYPE.LOCK_HASH_COMPLETED]: BLOCK_RECEIPT_GROUP.BALANCE_CHANGE,
	[BLOCK_RECEIPT_TYPE.LOCK_HASH_EXPIRED]: BLOCK_RECEIPT_GROUP.BALANCE_CHANGE,
	[BLOCK_RECEIPT_TYPE.LOCK_SECRET_CREATED]: BLOCK_RECEIPT_GROUP.BALANCE_CHANGE,
	[BLOCK_RECEIPT_TYPE.LOCK_SECRET_COMPLETED]: BLOCK_RECEIPT_GROUP.BALANCE_CHANGE,
	[BLOCK_RECEIPT_TYPE.LOCK_SECRET_EXPIRED]: BLOCK_RECEIPT_GROUP.BALANCE_CHANGE,
	[BLOCK_RECEIPT_TYPE.MOSAIC_RENTAL_FEE]: BLOCK_RECEIPT_GROUP.BALANCE_TRANSFER,
	[BLOCK_RECEIPT_TYPE.NAMESPACE_RENTAL_FEE]: BLOCK_RECEIPT_GROUP.BALANCE_TRANSFER,
	[BLOCK_RECEIPT_TYPE.MOSAIC_EXPIRED]: BLOCK_RECEIPT_GROUP.ARTIFACT_EXPIRY,
	[BLOCK_RECEIPT_TYPE.NAMESPACE_EXPIRED]: BLOCK_RECEIPT_GROUP.ARTIFACT_EXPIRY,
	[BLOCK_RECEIPT_TYPE.NAMESPACE_DELETED]: BLOCK_RECEIPT_GROUP.ARTIFACT_EXPIRY,
	[BLOCK_RECEIPT_TYPE.INFLATION]: BLOCK_RECEIPT_GROUP.INFLATION
};

const getStatementReceipts = response =>
	(Array.isArray(response?.data) ? response.data : []).flatMap(item => item.statement?.receipts || []);

const getStatementCount = response => Array.isArray(response?.data) ? response.data.length : 0;

const isLastStatementPage = (response, pageNumber, pageSize) => {
	const totalPages = Number(response?.pagination?.totalPages);

	return Number.isFinite(totalPages) && totalPages > 0
		? pageNumber >= totalPages
		: getStatementCount(response) < pageSize;
};

const isNativeMosaicId = mosaicId => `${mosaicId}`.toUpperCase() === `${config.NATIVE_MOSAIC_ID}`.toUpperCase();

const mosaicFromReceipt = receipt => {
	if (!receipt.mosaicId)
		return null;

	const isNative = isNativeMosaicId(receipt.mosaicId);

	return {
		id: receipt.mosaicId,
		name: receipt.mosaicId,
		amount: isNative ? absoluteToRelative(receipt.amount || 0) : receipt.amount,
		isNative
	};
};

const receiptFromDTO = receipt => {
	const type = Number(receipt.type);
	const mosaic = mosaicFromReceipt(receipt);

	return {
		version: Number(receipt.version || 0),
		type: receiptTypeNames[type],
		group: receiptGroupMap[type],
		targetAddress: receipt.targetAddress ? hexToSymbolAddress(receipt.targetAddress) : null,
		sender: receipt.senderAddress ? hexToSymbolAddress(receipt.senderAddress) : null,
		to: receipt.recipientAddress ? hexToSymbolAddress(receipt.recipientAddress) : null,
		artifactId: receipt.artifactId,
		mosaics: mosaic ? [mosaic] : []
	};
};

export const fetchBlockReceiptPage = async searchParams => {
	const pageSize = 100;
	const initialPageNumber = Number(searchParams?.pageNumber || 1);
	const receiptSearchParams = {
		...searchParams,
		pageSize
	};
	let pageNumber = initialPageNumber;
	let receipts = [];
	let isLastPage = false;

	while (!receipts.length && !isLastPage) {
		const url = createSymbolSearchURL('statements/transaction', { ...receiptSearchParams, pageNumber });
		const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
		receipts = getStatementReceipts(response)
			.map(receiptFromDTO)
			.filter(receipt => !!receipt.group);
		isLastPage = isLastStatementPage(response, pageNumber, pageSize);

		if (!receipts.length && !isLastPage)
			pageNumber++;
	}

	return {
		data: receipts,
		pageNumber
	};
};
