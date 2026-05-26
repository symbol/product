import { absoluteToRelative, createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

const ZERO_PUBLIC_KEY = '0'.repeat(64);
const ACCOUNT_NAMESPACE_LOOKUP_ERROR_STATUSES = [400, 404, 409];

const parseNetworkAmount = value => Number(`${value || ''}`.replace(/'/g, ''));
const absoluteToRelativeByDivisibility = (amount, divisibility = config.NATIVE_MOSAIC_DIVISIBILITY) =>
	Number(amount || 0) / Math.pow(10, divisibility || 0);

const fetchTotalChainImportance = async () => {
	const networkProperties = await fetchSymbolNode('network/properties');
	const totalChainImportance = parseNetworkAmount(networkProperties.chain?.totalChainImportance);

	if (!totalChainImportance)
		throw new Error('Missing totalChainImportance network property');

	return totalChainImportance;
};

const fetchAccountNamespaces = async addresses => {
	const uniqueAddresses = [...new Set(addresses)].filter(address => !!address);

	if (!uniqueAddresses.length)
		return {};

	try {
		const response = await fetchSymbolNode('namespaces/account/names', {
			method: 'POST',
			body: JSON.stringify({
				addresses: uniqueAddresses
			}),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		return Object.fromEntries((response.accountNames || []).map(item => [hexToSymbolAddress(item.address), item.names || []]));
	} catch (error) {
		if (
			ACCOUNT_NAMESPACE_LOOKUP_ERROR_STATUSES.includes(error.response?.status)
			|| ACCOUNT_NAMESPACE_LOOKUP_ERROR_STATUSES.includes(error.response?.data?.status)
		)
			return {};

		throw error;
	}
};

const accountInfoFromDTO = (data, accountNamespaces = {}, totalChainImportance, balanceMosaicId, balanceMosaicDivisibility) => {
	const account = data.account || {};
	const mosaics = account.mosaics || [];
	const balanceMosaic = balanceMosaicId
		? mosaics.find(mosaic => mosaic.id === balanceMosaicId)
		: mosaics[0];
	const address = hexToSymbolAddress(account.address);

	return {
		address,
		publicKey: account.publicKey === ZERO_PUBLIC_KEY ? null : (account.publicKey || null),
		description: null,
		namespaces: accountNamespaces[address] || [],
		balance: balanceMosaicId
			? absoluteToRelativeByDivisibility(balanceMosaic?.amount || 0, balanceMosaicDivisibility)
			: absoluteToRelative(balanceMosaic?.amount || 0),
		vestedBalance: 0,
		importance: (Number(account.importance || 0) / totalChainImportance) * 100,
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
	const cleanParams = { ...(searchParams || {}) };
	const { isLatest, isRichList, mosaicDivisibility } = cleanParams;

	delete cleanParams.isLatest;
	delete cleanParams.isActiveHarvesting;
	delete cleanParams.isRichList;
	delete cleanParams.mosaicDivisibility;

	if (cleanParams.mosaic) {
		cleanParams.mosaicId = cleanParams.mosaic;
		delete cleanParams.mosaic;
		cleanParams.orderBy = 'balance';
		cleanParams.order = 'desc';
	}

	if (isLatest)
		cleanParams.orderBy = 'id';

	if (isRichList) {
		cleanParams.orderBy = 'balance';
		cleanParams.mosaicId = config.NATIVE_MOSAIC_ID;
	}

	const url = createSymbolSearchURL('accounts', cleanParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);
	const addresses = (response.data || []).map(data => hexToSymbolAddress(data.account?.address));
	const totalChainImportance = await fetchTotalChainImportance();
	const accountNamespaces = await fetchAccountNamespaces(addresses);

	return createSymbolPage(response, pageNumber, data => accountInfoFromDTO(
		data,
		accountNamespaces,
		totalChainImportance,
		cleanParams.mosaicId,
		mosaicDivisibility
	));
};

export const fetchAccountInfo = createTryFetchInfoFunction(async address => {
	const data = await fetchSymbolNode(`accounts/${hexToSymbolAddress(address)}`);
	const totalChainImportance = await fetchTotalChainImportance();

	return accountInfoFromDTO(data, {}, totalChainImportance);
});

export const fetchAccountInfoByPublicKey = createTryFetchInfoFunction(async publicKey => {
	const data = await fetchSymbolNode(`accounts/${publicKey}`);
	const totalChainImportance = await fetchTotalChainImportance();

	return accountInfoFromDTO(data, {}, totalChainImportance);
});
