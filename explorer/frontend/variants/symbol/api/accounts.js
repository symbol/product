import {
	absoluteToRelative,
	createSymbolNodePath,
	createSymbolPage,
	createSymbolSearchURL,
	fetchSymbolNode,
	hexToSymbolAddress
} from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

const ZERO_PUBLIC_KEY = '0'.repeat(64);
const supportedSearchParamNames = new Set(['order', 'pageNumber', 'pageSize']);

const hasUnsupportedSearchParams = (searchParams = {}) =>
	Object.keys(searchParams).some(key => !supportedSearchParamNames.has(key));

const pickSearchParams = (searchParams = {}) => {
	const { order, pageNumber, pageSize } = searchParams;

	return {
		...(order && { order }),
		...(pageNumber && { pageNumber }),
		...(pageSize && { pageSize })
	};
};

const emptyPage = searchParams => ({
	data: [],
	pageNumber: Number(searchParams?.pageNumber || 1)
});

const accountInfoFromDTO = data => {
	const account = data.account || {};
	const mosaics = account.mosaics || [];
	const nativeMosaic = mosaics.find(mosaic => mosaic.id === config.NATIVE_MOSAIC_ID) || mosaics[0];

	return {
		remoteAddress: null,
		address: hexToSymbolAddress(account.address),
		publicKey: account.publicKey === ZERO_PUBLIC_KEY ? null : (account.publicKey || null),
		description: null,
		balance: absoluteToRelative(nativeMosaic?.amount || 0),
		vestedBalance: 0,
		mosaics: mosaics.map(mosaic => ({
			name: mosaic.id === config.NATIVE_MOSAIC_ID ? config.NATIVE_MOSAIC_TICKER : mosaic.id,
			id: mosaic.id,
			amount: absoluteToRelative(mosaic.amount || 0),
			isCreatedByAccount: false
		})),
		importance: (Number(account.importance || 0) / 9000000000000000) * 100,
		harvestedBlocks: null,
		harvestedFees: null,
		height: Number(account.addressHeight || 0) || null,
		minCosignatories: 0,
		cosignatoryOf: [],
		cosignatories: [],
		isMultisig: false,
		isHarvestingActive: !!account.supplementalPublicKeys?.linked
	};
};

export const fetchAccountPage = async searchParams => {
	if (hasUnsupportedSearchParams(searchParams))
		return emptyPage(searchParams);

	const url = createSymbolSearchURL('accounts', pickSearchParams(searchParams));
	const response = await fetchSymbolNode(createSymbolNodePath(url));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, accountInfoFromDTO);
};

export const fetchAccountInfo = createTryFetchInfoFunction(async address => {
	const account = await fetchSymbolNode(`accounts/${address}`);

	return accountInfoFromDTO(account);
});

export const fetchAccountInfoByPublicKey = createTryFetchInfoFunction(async publicKey => {
	const account = await fetchSymbolNode(`accounts/${publicKey}`);

	return accountInfoFromDTO(account);
});
