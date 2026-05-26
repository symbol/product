import { absoluteToRelative, createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';
import { generateNamespacePath } from 'symbol-sdk/symbol';

const NAMESPACE_ALIAS_TYPE = {
	NONE: 0,
	MOSAIC: 1,
	ADDRESS: 2
};

const METADATA_TYPE = {
	NAMESPACE: 2
};

const RECEIPT_TYPE = {
	NAMESPACE_RENTAL_FEE: 4942
};

const NAMESPACE_REGISTRATION_TYPE = {
	ROOT: 0,
	SUB: 1
};

const NAMESPACE_ID_PATTERN = /^[0-9A-Fa-f]{16}$/;
const formatNamespaceId = namespaceId => namespaceId.toString(16).toUpperCase().padStart(16, '0');

const hexToUtf8 = value => {
	if (!value || !/^(?:[0-9A-Fa-f]{2})+$/.test(value))
		return '';

	const bytes = new Uint8Array(value.match(/.{2}/g).map(byte => parseInt(byte, 16)));

	return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
};

export const namespaceIdFromName = async name => {
	if (NAMESPACE_ID_PATTERN.test(name))
		return name.toUpperCase();

	try {
		const namespacePath = generateNamespacePath(name);

		return formatNamespaceId(namespacePath[namespacePath.length - 1]);
	} catch {
		return name;
	}
};

const getNamespaceId = data => {
	const namespace = data.namespace || {};

	return namespace[`level${namespace.depth - 1}`] || namespace.level0;
};

const getNamespaceIds = data => {
	const namespace = data.namespace || {};
	const depth = Number(namespace.depth || 0);

	return Array.from({ length: depth }, (_, index) => namespace[`level${index}`]).filter(namespaceId => !!namespaceId);
};

const getNamespaceName = (data, namespaceNames) => {
	const namespaceIds = getNamespaceIds(data);
	const nameParts = namespaceIds.map(namespaceId => namespaceNames[namespaceId]);

	if (!nameParts.length || !nameParts.every(name => !!name))
		return null;

	return nameParts.reduce((fullName, name) => {
		if (!fullName)
			return name;

		return name.startsWith(`${fullName}.`) ? name : `${fullName}.${name}`;
	}, '');
};

const getNamespaceLevelName = (namespaceId, namespaceNames) => {
	const namespaceName = namespaceNames[namespaceId];

	return namespaceName ? namespaceName.split('.').pop() : null;
};

const getNamespaceLevels = (data, namespaceNames) => {
	const namespaceIds = getNamespaceIds(data);

	return namespaceIds
		.map((namespaceId, index) => ({
			name: getNamespaceLevelName(namespaceId, namespaceNames),
			namespaceId,
			parentId: index ? namespaceIds[index - 1] : null
		}))
		.reverse();
};

const fetchNamespaceNames = async namespaceIds => {
	const uniqueNamespaceIds = [...new Set(namespaceIds)];

	if (!uniqueNamespaceIds.length)
		return {};

	try {
		const namespaceNames = await fetchSymbolNode('namespaces/names', {
			method: 'POST',
			body: JSON.stringify({
				namespaceIds: uniqueNamespaceIds
			}),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		return Object.fromEntries(namespaceNames.map(item => [item.id, item.name]));
	} catch (error) {
		if ([400, 404, 409].includes(error.response?.status) || [400, 404, 409].includes(error.response?.data?.status))
			return {};

		throw error;
	}
};

const aliasInfoFromDTO = alias => {
	const aliasType = Number(alias?.type || NAMESPACE_ALIAS_TYPE.NONE);

	switch (aliasType) {
	case NAMESPACE_ALIAS_TYPE.MOSAIC:
		return {
			aliasType: 'mosaic',
			aliasMosaicId: alias.mosaicId || null,
			aliasAddress: null
		};
	case NAMESPACE_ALIAS_TYPE.ADDRESS:
		return {
			aliasType: 'address',
			aliasMosaicId: null,
			aliasAddress: alias.address ? hexToSymbolAddress(alias.address) : null
		};
	case NAMESPACE_ALIAS_TYPE.NONE:
	default:
		return {
			aliasType: 'none',
			aliasMosaicId: null,
			aliasAddress: null
		};
	}
};

const namespaceInfoFromDTO = (data, namespaceNames = {}) => {
	const namespace = data.namespace || {};
	const startHeight = Number(namespace.startHeight || 0);
	const endHeight = Number(namespace.endHeight || 0);
	const isRoot = namespace.registrationType === 0;
	const aliasInfo = aliasInfoFromDTO(namespace.alias);

	// Resolve the most specific namespace ID for this entry
	const namespaceId = getNamespaceId(data);

	return {
		name: namespaceId,
		id: namespaceId,
		namespaceName: getNamespaceName(data, namespaceNames),
		namespaceLevels: getNamespaceLevels(data, namespaceNames),
		...aliasInfo,
		creator: hexToSymbolAddress(namespace.ownerAddress),
		registrationHeight: startHeight,
		expirationHeight: endHeight || null,
		isUnlimitedDuration: false,
		subNamespaceCount: isRoot ? 0 : null,
		subNamespaces: [],
		namespaceMosaics: []
	};
};

const namespaceMetadataEntryFromDTO = data => {
	const metadataEntry = data.metadataEntry || {};

	return {
		scopedMetadataKey: metadataEntry.scopedMetadataKey?.toUpperCase() || null,
		senderAddress: hexToSymbolAddress(metadataEntry.sourceAddress),
		targetAddress: hexToSymbolAddress(metadataEntry.targetAddress),
		value: hexToUtf8(metadataEntry.value)
	};
};

const getStatementReceipts = response =>
	(Array.isArray(response?.data) ? response.data : []).flatMap(item => item.statement?.receipts || []);

const isNativeMosaicId = mosaicId => `${mosaicId}`.toUpperCase() === `${config.NATIVE_MOSAIC_ID}`.toUpperCase();

const namespaceRentalFeeReceiptFromDTO = receipt => {
	const mosaicId = receipt.mosaicId;

	return {
		version: Number(receipt.version || 0),
		type: 'namespaceRentalFee',
		to: hexToSymbolAddress(receipt.recipientAddress),
		mosaic: {
			id: mosaicId,
			name: mosaicId,
			amount: isNativeMosaicId(mosaicId) ? absoluteToRelative(receipt.amount || 0) : receipt.amount,
			isNative: isNativeMosaicId(mosaicId)
		}
	};
};

const createNamespaceSearchParams = (searchParams = {}) => {
	const namespaceSearchParams = {
		...searchParams,
		order: 'desc'
	};
	const { isAddressAlias, isMosaicAlias, isRoot, isSub } = namespaceSearchParams;

	delete namespaceSearchParams.isRecent;
	delete namespaceSearchParams.isAddressAlias;
	delete namespaceSearchParams.isMosaicAlias;
	delete namespaceSearchParams.isRoot;
	delete namespaceSearchParams.isSub;

	if (isAddressAlias)
		namespaceSearchParams.aliasType = NAMESPACE_ALIAS_TYPE.ADDRESS;

	if (isMosaicAlias)
		namespaceSearchParams.aliasType = NAMESPACE_ALIAS_TYPE.MOSAIC;

	if (isRoot)
		namespaceSearchParams.registrationType = NAMESPACE_REGISTRATION_TYPE.ROOT;

	if (isSub)
		namespaceSearchParams.registrationType = NAMESPACE_REGISTRATION_TYPE.SUB;

	return namespaceSearchParams;
};

export const fetchNamespacePage = async searchParams => {
	const url = createSymbolSearchURL('namespaces', createNamespaceSearchParams(searchParams));
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const namespaceIds = (response.data || [])
		.flatMap(getNamespaceIds);
	const namespaceNames = await fetchNamespaceNames(namespaceIds);
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, data => namespaceInfoFromDTO(data, namespaceNames));
};

export const fetchNamespaceInfo = createTryFetchInfoFunction(async id => {
	const namespaceId = await namespaceIdFromName(id);
	const data = await fetchSymbolNode(`namespaces/${namespaceId}`);
	const namespaceNames = await fetchNamespaceNames(getNamespaceIds(data));

	return namespaceInfoFromDTO(data, namespaceNames);
});

export const fetchNamespaceMetadataPage = async searchParams => {
	const namespaceId = await namespaceIdFromName(searchParams.targetId);
	const metadataSearchParams = {
		...searchParams,
		targetId: namespaceId,
		metadataType: METADATA_TYPE.NAMESPACE,
		pageSize: 10
	};
	const url = createSymbolSearchURL('metadata', metadataSearchParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, namespaceMetadataEntryFromDTO);
};

export const fetchNamespaceReceiptPage = async searchParams => {
	const receiptSearchParams = {
		...searchParams,
		receiptType: RECEIPT_TYPE.NAMESPACE_RENTAL_FEE,
		pageSize: 10
	};
	const url = createSymbolSearchURL('statements/transaction', receiptSearchParams);
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const receipts = getStatementReceipts(response)
		.filter(receipt => Number(receipt.type) === RECEIPT_TYPE.NAMESPACE_RENTAL_FEE)
		.map(namespaceRentalFeeReceiptFromDTO);
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return {
		data: receipts,
		pageNumber
	};
};
