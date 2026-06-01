import {
	absoluteToRelative,
	createSymbolPage,
	createSymbolSearchURL,
	fetchSymbolNode,
	hexToSymbolAddress,
	publicKeyToSymbolAddress
} from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

const ZERO_PUBLIC_KEY = '0'.repeat(64);
const ACCOUNT_NAMESPACE_LOOKUP_ERROR_STATUSES = [400, 404, 409];
const MOSAIC_NAMESPACE_LOOKUP_ERROR_STATUSES = [400, 404, 409];
const MOSAIC_PROPERTIES_LOOKUP_ERROR_STATUSES = [400, 404, 409];
const MOSAIC_PROPERTIES_BATCH_SIZE = 100;
const accountTypeMap = {
	0: 'unlinked',
	1: 'main',
	2: 'remote',
	3: 'remoteUnlinked'
};
const votingKeyStatusOrder = {
	current: 0,
	future: 1,
	expired: 2
};

const parseNetworkAmount = value => Number(`${value || ''}`.replace(/'/g, ''));
const absoluteToRelativeByDivisibility = (amount, divisibility = config.NATIVE_MOSAIC_DIVISIBILITY) =>
	Number(amount || 0) / Math.pow(10, Number(divisibility ?? config.NATIVE_MOSAIC_DIVISIBILITY) || 0);

const fetchTotalChainImportance = async () => {
	const networkProperties = await fetchSymbolNode('network/properties');
	const totalChainImportance = parseNetworkAmount(networkProperties.chain?.totalChainImportance);

	if (!totalChainImportance)
		throw new Error('Missing totalChainImportance network property');

	return totalChainImportance;
};

const fetchCurrentFinalizationEpoch = async () => {
	const chainInfo = await fetchSymbolNode('chain/info');

	return Number(chainInfo.latestFinalizedBlock?.finalizationEpoch || 0);
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

const fetchMosaicNames = async mosaicIds => {
	const uniqueMosaicIds = [...new Set(mosaicIds)].filter(id => !!id);

	if (!uniqueMosaicIds.length)
		return {};

	try {
		const { mosaicNames = [] } = await fetchSymbolNode('namespaces/mosaic/names', {
			method: 'POST',
			body: JSON.stringify({
				mosaicIds: uniqueMosaicIds
			}),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		return Object.fromEntries(mosaicNames.map(item => [item.mosaicId, item.names || []]));
	} catch (error) {
		if (
			MOSAIC_NAMESPACE_LOOKUP_ERROR_STATUSES.includes(error.response?.status)
			|| MOSAIC_NAMESPACE_LOOKUP_ERROR_STATUSES.includes(error.response?.data?.status)
		)
			return {};

		throw error;
	}
};

const fetchMosaicProperties = async mosaicIds => {
	const uniqueMosaicIds = [...new Set(mosaicIds)].filter(id => !!id);

	if (!uniqueMosaicIds.length)
		return {};

	try {
		const mosaicInfoResponses = [];

		for (let i = 0; i < uniqueMosaicIds.length; i += MOSAIC_PROPERTIES_BATCH_SIZE) {
			const mosaicIdsChunk = uniqueMosaicIds.slice(i, i + MOSAIC_PROPERTIES_BATCH_SIZE);
			const response = await fetchSymbolNode('mosaics', {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds: mosaicIdsChunk
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});

			mosaicInfoResponses.push(...(Array.isArray(response) ? response : response.data || []));
		}

		return Object.fromEntries(mosaicInfoResponses.map(data => {
			const mosaic = data.mosaic || {};

			return [mosaic.id, {
				divisibility: Number(mosaic.divisibility || 0),
				ownerAddress: mosaic.ownerAddress || null
			}];
		}).filter(([id]) => !!id));
	} catch (error) {
		if (
			MOSAIC_PROPERTIES_LOOKUP_ERROR_STATUSES.includes(error.response?.status)
			|| MOSAIC_PROPERTIES_LOOKUP_ERROR_STATUSES.includes(error.response?.data?.status)
		)
			return {};

		throw error;
	}
};

const getMosaicName = (mosaicId, mosaicNames) => {
	const namespaceName = mosaicNames[mosaicId]?.[0];

	if (namespaceName)
		return namespaceName;

	return mosaicId === config.NATIVE_MOSAIC_ID ? config.NATIVE_MOSAIC_TICKER : mosaicId;
};

const getMosaicDivisibility = (mosaicId, mosaicProperties) => {
	if (Object.prototype.hasOwnProperty.call(mosaicProperties, mosaicId))
		return mosaicProperties[mosaicId].divisibility;

	return mosaicId === config.NATIVE_MOSAIC_ID ? config.NATIVE_MOSAIC_DIVISIBILITY : 0;
};

const isMosaicCreatedByAccount = (mosaicId, mosaicProperties, address) => {
	const ownerAddress = mosaicProperties[mosaicId]?.ownerAddress;

	return !!ownerAddress && hexToSymbolAddress(ownerAddress) === address;
};

const supplementalPublicKeyToAddress = publicKey => publicKey ? publicKeyToSymbolAddress(publicKey) : null;

const getVotingKeyStatus = (startEpoch, endEpoch, currentEpoch) => {
	if (currentEpoch < startEpoch)
		return 'future';

	return currentEpoch < endEpoch ? 'current' : 'expired';
};

const votingKeyFromDTO = (votingKey, currentEpoch) => {
	const startEpoch = Number(votingKey.startEpoch || 0);
	const endEpoch = Number(votingKey.endEpoch || 0);

	return {
		publicKey: votingKey.publicKey || null,
		startEpoch,
		endEpoch,
		status: getVotingKeyStatus(startEpoch, endEpoch, currentEpoch)
	};
};

const sortVotingKeys = votingKeys => [...votingKeys].sort((left, right) =>
	votingKeyStatusOrder[left.status] - votingKeyStatusOrder[right.status]);

const activityBucketFromDTO = activityBucket => ({
	recalculationBlock: Number(activityBucket.startHeight || 0),
	totalFeesPaid: Number(activityBucket.totalFeesPaid || 0),
	beneficiaryCount: Number(activityBucket.beneficiaryCount || 0),
	importanceScore: Number(activityBucket.rawScore || 0)
});

const accountInfoFromDTO = (
	data,
	accountNamespaces = {},
	totalChainImportance,
	currentFinalizationEpoch = 0,
	balanceMosaicId,
	balanceMosaicDivisibility,
	mosaicProperties = {},
	mosaicNames = {}
) => {
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
		accountType: accountTypeMap[account.accountType] || null,
		supplementalKeys: {
			linked: supplementalPublicKeyToAddress(account.supplementalPublicKeys?.linked?.publicKey),
			node: supplementalPublicKeyToAddress(account.supplementalPublicKeys?.node?.publicKey),
			vrf: supplementalPublicKeyToAddress(account.supplementalPublicKeys?.vrf?.publicKey)
		},
		votingKeys: sortVotingKeys((account.supplementalPublicKeys?.voting?.publicKeys || [])
			.map(votingKey => votingKeyFromDTO(votingKey, currentFinalizationEpoch))),
		importanceHistory: (account.activityBuckets || []).map(activityBucketFromDTO),
		mosaics: mosaics.map(m => {
			const divisibility = getMosaicDivisibility(m.id, mosaicProperties);

			return {
				id: m.id,
				name: getMosaicName(m.id, mosaicNames),
				amount: absoluteToRelativeByDivisibility(m.amount || 0, divisibility),
				isCreatedByAccount: isMosaicCreatedByAccount(m.id, mosaicProperties, address)
			};
		}),
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
	const [totalChainImportance, accountNamespaces] = await Promise.all([
		fetchTotalChainImportance(),
		fetchAccountNamespaces(addresses)
	]);

	return createSymbolPage(response, pageNumber, data => accountInfoFromDTO(
		data,
		accountNamespaces,
		totalChainImportance,
		0,
		cleanParams.mosaicId,
		mosaicDivisibility
	));
};

export const fetchAccountInfo = createTryFetchInfoFunction(async address => {
	const data = await fetchSymbolNode(`accounts/${hexToSymbolAddress(address)}`);
	const accountAddress = hexToSymbolAddress(data.account?.address);
	const mosaicIds = (data.account?.mosaics || []).map(mosaic => mosaic.id);
	const [
		totalChainImportance,
		currentFinalizationEpoch,
		accountNamespaces,
		mosaicProperties,
		mosaicNames
	] = await Promise.all([
		fetchTotalChainImportance(),
		fetchCurrentFinalizationEpoch(),
		fetchAccountNamespaces([accountAddress]),
		fetchMosaicProperties(mosaicIds),
		fetchMosaicNames(mosaicIds)
	]);

	return accountInfoFromDTO(
		data,
		accountNamespaces,
		totalChainImportance,
		currentFinalizationEpoch,
		undefined,
		undefined,
		mosaicProperties,
		mosaicNames
	);
});

export const fetchAccountInfoByPublicKey = createTryFetchInfoFunction(async publicKey => {
	const data = await fetchSymbolNode(`accounts/${publicKey}`);
	const accountAddress = hexToSymbolAddress(data.account?.address);
	const mosaicIds = (data.account?.mosaics || []).map(mosaic => mosaic.id);
	const [
		totalChainImportance,
		currentFinalizationEpoch,
		accountNamespaces,
		mosaicProperties,
		mosaicNames
	] = await Promise.all([
		fetchTotalChainImportance(),
		fetchCurrentFinalizationEpoch(),
		fetchAccountNamespaces([accountAddress]),
		fetchMosaicProperties(mosaicIds),
		fetchMosaicNames(mosaicIds)
	]);

	return accountInfoFromDTO(
		data,
		accountNamespaces,
		totalChainImportance,
		currentFinalizationEpoch,
		undefined,
		undefined,
		mosaicProperties,
		mosaicNames
	);
});
