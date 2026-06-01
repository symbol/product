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

export const ACCOUNT_BALANCE_CHANGE_RECEIPT_TYPES = [
	BLOCK_RECEIPT_TYPE.LOCK_HASH_CREATED,
	BLOCK_RECEIPT_TYPE.LOCK_HASH_COMPLETED,
	BLOCK_RECEIPT_TYPE.LOCK_HASH_EXPIRED,
	BLOCK_RECEIPT_TYPE.LOCK_SECRET_CREATED,
	BLOCK_RECEIPT_TYPE.LOCK_SECRET_COMPLETED,
	BLOCK_RECEIPT_TYPE.LOCK_SECRET_EXPIRED
];

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
	(Array.isArray(response?.data) ? response.data : []).flatMap(item =>
		(item.statement?.receipts || []).map(receipt => ({
			...receipt,
			height: Number(item.statement?.height || 0)
		})));

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
		height: receipt.height,
		type: receiptTypeNames[type],
		group: receiptGroupMap[type],
		targetAddress: receipt.targetAddress ? hexToSymbolAddress(receipt.targetAddress) : null,
		sender: receipt.senderAddress ? hexToSymbolAddress(receipt.senderAddress) : null,
		to: receipt.recipientAddress ? hexToSymbolAddress(receipt.recipientAddress) : null,
		artifactId: receipt.artifactId || null,
		mosaics: mosaic ? [mosaic] : []
	};
};

export const fetchBlockReceiptPage = async searchParams => {
	const { excludedReceiptTypes = [], group, includedReceiptTypes = [], ...restSearchParams } = searchParams || {};
	const requestedReceiptType = searchParams?.receiptType;
	const requestedTargetAddress = searchParams?.targetAddress ? hexToSymbolAddress(searchParams.targetAddress) : null;
	const excludedReceiptTypeSet = new Set(excludedReceiptTypes.map(type => Number(type)));
	const includedReceiptTypeSet = new Set(includedReceiptTypes.map(type => Number(type)));
	const shouldSearchNextPageOnEmpty = !group
		&& !requestedReceiptType
		&& !requestedTargetAddress
		&& !excludedReceiptTypes.length
		&& !includedReceiptTypes.length
		&& !searchParams?.senderAddress
		&& !searchParams?.recipientAddress;
	const pageSize = 100;
	const initialPageNumber = Number(searchParams?.pageNumber || 1);
	const receiptSearchParams = {
		...restSearchParams,
		pageSize
	};
	let pageNumber = initialPageNumber;
	let receipts = [];
	let isLastPage = false;
	const formatResponseReceipts = response => getStatementReceipts(response)
		.filter(receipt => !requestedReceiptType || Number(receipt.type) === Number(requestedReceiptType))
		.filter(receipt => !includedReceiptTypeSet.size || includedReceiptTypeSet.has(Number(receipt.type)))
		.filter(receipt => !excludedReceiptTypeSet.has(Number(receipt.type)))
		.map(receiptFromDTO)
		.filter(receipt => !!receipt.group && (!group || receipt.group === group))
		.filter(receipt => !requestedTargetAddress || receipt.targetAddress === requestedTargetAddress);

	if (includedReceiptTypes.length && !requestedReceiptType) {
		const url = createSymbolSearchURL('statements/transaction', {
			...receiptSearchParams,
			pageNumber,
			receiptType: includedReceiptTypes
		});
		const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
		receipts = formatResponseReceipts(response)
			.sort((left, right) => right.height - left.height);

		return {
			data: receipts,
			pageNumber
		};
	}

	while (!receipts.length && !isLastPage) {
		const url = createSymbolSearchURL('statements/transaction', { ...receiptSearchParams, pageNumber });
		const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
		receipts = formatResponseReceipts(response);
		isLastPage = isLastStatementPage(response, pageNumber, pageSize);

		if (!receipts.length && !isLastPage && shouldSearchNextPageOnEmpty)
			pageNumber++;
		else if (!receipts.length)
			break;
	}

	return {
		data: receipts,
		pageNumber
	};
};
