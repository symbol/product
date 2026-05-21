import { createSymbolPage, createSymbolSearchURL, fetchSymbolNode, hexToSymbolAddress } from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

const NAMESPACE_ALIAS_TYPE = {
	MOSAIC: 1,
	ADDRESS: 2
};

const NAMESPACE_REGISTRATION_TYPE = {
	ROOT: 0,
	SUB: 1
};

const NAMESPACE_ID_PATTERN = /^[0-9A-Fa-f]{16}$/;
const NAMESPACE_FLAG = 1n << 63n;

const uint32ToBytes = value => new Uint8Array([
	value & 0xFF,
	(value >> 8) & 0xFF,
	(value >> 16) & 0xFF,
	(value >> 24) & 0xFF
]);

const digestToBigInt = digest => {
	let result = 0n;

	for (let i = 0; 8 > i; ++i)
		result += BigInt(digest[i]) << BigInt(8 * i);

	return result;
};

const isValidNamespaceName = name => {
	const isAlphanum = character => ('a' <= character && 'z' >= character) || ('0' <= character && '9' >= character);

	if (!name || !isAlphanum(name[0]))
		return false;

	for (let i = 0; i < name.length; ++i) {
		const character = name[i];

		if (!isAlphanum(character) && '_' !== character && '-' !== character)
			return false;
	}

	return true;
};

const generateNamespaceId = async (name, parentNamespaceId = 0n) => {
	const { createHash } = await import('crypto');
	const hash = createHash('sha3-256');

	hash.update(uint32ToBytes(Number(parentNamespaceId & 0xFFFFFFFFn)));
	hash.update(uint32ToBytes(Number((parentNamespaceId >> 32n) & 0xFFFFFFFFn)));
	hash.update(new TextEncoder().encode(name));

	return digestToBigInt(hash.digest()) | NAMESPACE_FLAG;
};

const namespaceIdFromName = async name => {
	if (NAMESPACE_ID_PATTERN.test(name))
		return name.toUpperCase();

	const namespaceNames = name.split('.');

	if (!namespaceNames.every(isValidNamespaceName))
		return name;

	let namespaceId = 0n;

	for (const namespaceName of namespaceNames)
		namespaceId = await generateNamespaceId(namespaceName, namespaceId);

	return namespaceId.toString(16).toUpperCase().padStart(16, '0');
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

const namespaceInfoFromDTO = (data, namespaceNames = {}) => {
	const namespace = data.namespace || {};
	const startHeight = Number(namespace.startHeight || 0);
	const endHeight = Number(namespace.endHeight || 0);
	const isRoot = namespace.registrationType === 0;

	// Resolve the most specific namespace ID for this entry
	const namespaceId = getNamespaceId(data);

	return {
		name: namespaceId,
		id: namespaceId,
		namespaceName: getNamespaceName(data, namespaceNames),
		creator: hexToSymbolAddress(namespace.ownerAddress),
		registrationHeight: startHeight,
		expirationHeight: endHeight || null,
		isUnlimitedDuration: false,
		subNamespaceCount: isRoot ? 0 : null,
		subNamespaces: [],
		namespaceMosaics: []
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
