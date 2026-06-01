import { absoluteToRelative, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';

export const RECEIPT_TYPE = {
	MOSAIC_EXPIRED: 16717,
	MOSAIC_RENTAL_FEE: 4685,
	NAMESPACE_RENTAL_FEE: 4942
};

const getStatementReceipts = response =>
	(Array.isArray(response?.data) ? response.data : []).flatMap(item => item.statement?.receipts || []);

const isNativeMosaicId = mosaicId => `${mosaicId}`.toUpperCase() === `${config.NATIVE_MOSAIC_ID}`.toUpperCase();

const receiptTypeNames = {
	[RECEIPT_TYPE.MOSAIC_RENTAL_FEE]: 'mosaicRentalFee',
	[RECEIPT_TYPE.MOSAIC_EXPIRED]: 'mosaicExpired',
	[RECEIPT_TYPE.NAMESPACE_RENTAL_FEE]: 'namespaceRentalFee'
};

const rentalFeeReceiptFromDTO = receipt => {
	const {mosaicId} = receipt;
	const isNative = isNativeMosaicId(mosaicId);

	return {
		version: Number(receipt.version || 0),
		type: receiptTypeNames[Number(receipt.type)],
		to: hexToSymbolAddress(receipt.recipientAddress),
		mosaic: {
			id: mosaicId,
			name: mosaicId,
			amount: isNative ? absoluteToRelative(receipt.amount || 0) : receipt.amount,
			isNative
		}
	};
};

export const fetchRentalFeeReceiptPage = async (searchParams, receiptType = RECEIPT_TYPE.NAMESPACE_RENTAL_FEE) => {
	const receiptSearchParams = {
		...searchParams,
		receiptType,
		pageSize: 10
	};
	const url = createSymbolSearchURL('statements/transaction', receiptSearchParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const receipts = getStatementReceipts(response)
		.filter(receipt => Number(receipt.type) === receiptType)
		.map(rentalFeeReceiptFromDTO);
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return {
		data: receipts,
		pageNumber
	};
};

const artifactExpiryReceiptFromDTO = receipt => ({
	version: Number(receipt.version || 0),
	type: receiptTypeNames[Number(receipt.type)],
	artifactId: receipt.artifactId
});

export const fetchArtifactExpiryReceiptPage = async searchParams => {
	const receiptSearchParams = {
		...searchParams,
		receiptType: RECEIPT_TYPE.MOSAIC_EXPIRED,
		pageSize: 10
	};
	const url = createSymbolSearchURL('statements/transaction', receiptSearchParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const receipts = getStatementReceipts(response)
		.filter(receipt => Number(receipt.type) === RECEIPT_TYPE.MOSAIC_EXPIRED)
		.map(artifactExpiryReceiptFromDTO);
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return {
		data: receipts,
		pageNumber
	};
};
