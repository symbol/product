import { absoluteToRelative, createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

const ZERO_PUBLIC_KEY = '0'.repeat(64);

const accountInfoFromDTO = data => {
	const account = data.account || {};
	const mosaics = account.mosaics || [];
	const nativeMosaic = mosaics[0];

	return {
		address: hexToSymbolAddress(account.address),
		publicKey: account.publicKey === ZERO_PUBLIC_KEY ? null : (account.publicKey || null),
		description: null,
		balance: absoluteToRelative(nativeMosaic?.amount || 0),
		vestedBalance: 0,
		importance: (Number(account.importance || 0) / 9000000000000000) * 100,
		mosaics: mosaics.map(m => ({
			id: m.id,
			name: m.id === config.NATIVE_MOSAIC_ID ? config.NATIVE_MOSAIC_TICKER : m.id,
			amount: absoluteToRelative(m.amount || 0),
			isCreatedByAccount: false
		})),
		isHarvestingActive: !!account.supplementalPublicKeys?.linked,
		isMultisig: false,
		cosignatories: [],
		cosignatoryOf: [],
		harvestedBlocks: null,
		harvestedFees: null,
		height: Number(account.addressHeight || 0) || null,
		minCosignatories: 0,
		remoteAddress: null
	};
};

export const fetchAccountPage = async searchParams => {
	const { isLatest, isActiveHarvesting, ...cleanParams } = { ...(searchParams || {}) };
	const url = createSymbolSearchURL('accounts', cleanParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, accountInfoFromDTO);
};

export const fetchAccountInfo = createTryFetchInfoFunction(async address => {
	const data = await fetchSymbolNode(`accounts/${hexToSymbolAddress(address)}`);

	return accountInfoFromDTO(data);
});

export const fetchAccountInfoByPublicKey = createTryFetchInfoFunction(async publicKey => {
	const data = await fetchSymbolNode(`accounts/${publicKey}`);

	return accountInfoFromDTO(data);
});
