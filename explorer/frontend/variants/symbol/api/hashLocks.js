import { absoluteToRelative, createSymbolPage, createSymbolSearchURL, fetchSymbolNode } from '../utils';
import config from '@/config';

const hashLockStatuses = {
	0: 'unused',
	1: 'used'
};

const isNativeMosaicId = mosaicId => `${mosaicId}`.toUpperCase() === `${config.NATIVE_MOSAIC_ID}`.toUpperCase();

const mosaicFromLock = lock => {
	if (!lock.mosaicId)
		return null;

	const isNative = isNativeMosaicId(lock.mosaicId);

	return {
		id: lock.mosaicId,
		name: lock.mosaicId,
		amount: isNative ? absoluteToRelative(lock.amount || 0) : lock.amount,
		isNative
	};
};

const hashLockFromDTO = data => {
	const lock = data.lock || {};
	const mosaic = mosaicFromLock(lock);

	return {
		transactionHash: lock.hash,
		endHeight: Number(lock.endHeight || 0),
		status: hashLockStatuses[Number(lock.status)] || null,
		mosaics: mosaic ? [mosaic] : []
	};
};

export const fetchHashLockPage = async searchParams => {
	const url = createSymbolSearchURL('lock/hash', searchParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, hashLockFromDTO);
};
