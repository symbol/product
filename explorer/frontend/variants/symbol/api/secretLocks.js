import { absoluteToRelative, createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';

const secretLockStatuses = {
	0: 'unused',
	1: 'used'
};

const secretLockHashAlgorithms = {
	0: 'sha3256',
	1: 'hash160',
	2: 'hash256'
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

const secretLockFromDTO = data => {
	const lock = data.lock || {};
	const mosaic = mosaicFromLock(lock);

	return {
		recipient: lock.recipientAddress ? hexToSymbolAddress(lock.recipientAddress) : null,
		secret: lock.secret || null,
		endHeight: Number(lock.endHeight || 0),
		status: secretLockStatuses[Number(lock.status)] || null,
		hashAlgorithm: secretLockHashAlgorithms[Number(lock.hashAlgorithm)] || null,
		mosaics: mosaic ? [mosaic] : []
	};
};

export const fetchSecretLockPage = async searchParams => {
	const url = createSymbolSearchURL('lock/secret', searchParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, secretLockFromDTO);
};
