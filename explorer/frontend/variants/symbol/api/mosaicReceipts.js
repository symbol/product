import { fetchArtifactExpiryReceiptPage, fetchRentalFeeReceiptPage, RECEIPT_TYPE } from './receipts';

export const fetchMosaicReceiptPage = async searchParams => fetchRentalFeeReceiptPage(searchParams, RECEIPT_TYPE.MOSAIC_RENTAL_FEE);
export const fetchMosaicArtifactExpiryReceiptPage = async searchParams => fetchArtifactExpiryReceiptPage(searchParams);
