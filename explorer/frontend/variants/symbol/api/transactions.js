import {
	absoluteToRelative,
	createSymbolPage,
	createSymbolSearchURL,
	fetchSymbolNode,
	hexToSymbolAddress,
	isSymbolAddress,
	isSymbolPublicKey,
	publicKeyToSymbolAddress,
	symbolTimestampToDate
} from '../utils';
import { namespaceIdFromName } from './namespaces';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

const ZERO_PUBLIC_KEY = '0'.repeat(64);
const MOSAIC_ID_PATTERN = /^[0-9A-Fa-f]{16}$/;
const MOSAIC_ALIAS_TYPE = 1;
const SYMBOL_TRANSACTION_TYPE = {
	ACCOUNT_KEY_LINK: 'ACCOUNT_KEY_LINK',
	NODE_KEY_LINK: 'NODE_KEY_LINK',
	AGGREGATE_COMPLETE: 'AGGREGATE_COMPLETE',
	AGGREGATE_BONDED: 'AGGREGATE_BONDED',
	VOTING_KEY_LINK: 'VOTING_KEY_LINK',
	VRF_KEY_LINK: 'VRF_KEY_LINK',
	HASH_LOCK: 'HASH_LOCK',
	SECRET_LOCK: 'SECRET_LOCK',
	SECRET_PROOF: 'SECRET_PROOF',
	ACCOUNT_METADATA: 'ACCOUNT_METADATA',
	MOSAIC_METADATA: 'MOSAIC_METADATA',
	NAMESPACE_METADATA: 'NAMESPACE_METADATA',
	MOSAIC_DEFINITION: 'MOSAIC_DEFINITION',
	MOSAIC_SUPPLY_CHANGE: 'MOSAIC_SUPPLY_CHANGE',
	MOSAIC_SUPPLY_REVOCATION: 'MOSAIC_SUPPLY_REVOCATION',
	MULTISIG_ACCOUNT_MODIFICATION: 'MULTISIG_ACCOUNT_MODIFICATION',
	ADDRESS_ALIAS: 'ADDRESS_ALIAS',
	MOSAIC_ALIAS: 'MOSAIC_ALIAS',
	NAMESPACE_REGISTRATION: 'NAMESPACE_REGISTRATION',
	ACCOUNT_ADDRESS_RESTRICTION: 'ACCOUNT_ADDRESS_RESTRICTION',
	ACCOUNT_MOSAIC_RESTRICTION: 'ACCOUNT_MOSAIC_RESTRICTION',
	ACCOUNT_OPERATION_RESTRICTION: 'ACCOUNT_OPERATION_RESTRICTION',
	MOSAIC_ADDRESS_RESTRICTION: 'MOSAIC_ADDRESS_RESTRICTION',
	MOSAIC_GLOBAL_RESTRICTION: 'MOSAIC_GLOBAL_RESTRICTION',
	TRANSFER: 'TRANSFER'
};

const transactionTypeMap = {
	16716: SYMBOL_TRANSACTION_TYPE.ACCOUNT_KEY_LINK,
	16972: SYMBOL_TRANSACTION_TYPE.NODE_KEY_LINK,
	16705: SYMBOL_TRANSACTION_TYPE.AGGREGATE_COMPLETE,
	16961: SYMBOL_TRANSACTION_TYPE.AGGREGATE_BONDED,
	16707: SYMBOL_TRANSACTION_TYPE.VOTING_KEY_LINK,
	16963: SYMBOL_TRANSACTION_TYPE.VRF_KEY_LINK,
	16712: SYMBOL_TRANSACTION_TYPE.HASH_LOCK,
	16722: SYMBOL_TRANSACTION_TYPE.SECRET_LOCK,
	16978: SYMBOL_TRANSACTION_TYPE.SECRET_PROOF,
	16708: SYMBOL_TRANSACTION_TYPE.ACCOUNT_METADATA,
	16964: SYMBOL_TRANSACTION_TYPE.MOSAIC_METADATA,
	17220: SYMBOL_TRANSACTION_TYPE.NAMESPACE_METADATA,
	16717: SYMBOL_TRANSACTION_TYPE.MOSAIC_DEFINITION,
	16973: SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE,
	17229: SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION,
	16725: SYMBOL_TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION,
	16974: SYMBOL_TRANSACTION_TYPE.ADDRESS_ALIAS,
	17230: SYMBOL_TRANSACTION_TYPE.MOSAIC_ALIAS,
	16718: SYMBOL_TRANSACTION_TYPE.NAMESPACE_REGISTRATION,
	16720: SYMBOL_TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION,
	16976: SYMBOL_TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION,
	17232: SYMBOL_TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION,
	16977: SYMBOL_TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION,
	16721: SYMBOL_TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION,
	16724: SYMBOL_TRANSACTION_TYPE.TRANSFER
};
const transactionTypeCodeMap = Object.fromEntries(Object.entries(transactionTypeMap).map(([code, type]) => [type, code]));
const transactionTypeFilterMap = {
	TRANSFER: [SYMBOL_TRANSACTION_TYPE.TRANSFER],
	ACCOUNT: [
		SYMBOL_TRANSACTION_TYPE.ADDRESS_ALIAS,
		SYMBOL_TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION,
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_KEY_LINK,
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_METADATA,
		SYMBOL_TRANSACTION_TYPE.VOTING_KEY_LINK,
		SYMBOL_TRANSACTION_TYPE.VRF_KEY_LINK,
		SYMBOL_TRANSACTION_TYPE.NODE_KEY_LINK
	],
	AGGREGATE: [
		SYMBOL_TRANSACTION_TYPE.AGGREGATE_COMPLETE,
		SYMBOL_TRANSACTION_TYPE.AGGREGATE_BONDED,
		SYMBOL_TRANSACTION_TYPE.HASH_LOCK
	],
	ALIAS: [
		SYMBOL_TRANSACTION_TYPE.ADDRESS_ALIAS,
		SYMBOL_TRANSACTION_TYPE.MOSAIC_ALIAS
	],
	METADATA: [
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_METADATA,
		SYMBOL_TRANSACTION_TYPE.MOSAIC_METADATA,
		SYMBOL_TRANSACTION_TYPE.NAMESPACE_METADATA
	],
	MOSAIC: [
		SYMBOL_TRANSACTION_TYPE.MOSAIC_ALIAS,
		SYMBOL_TRANSACTION_TYPE.MOSAIC_DEFINITION,
		SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE,
		SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION,
		SYMBOL_TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.MOSAIC_METADATA
	],
	NAMESPACE: [
		SYMBOL_TRANSACTION_TYPE.NAMESPACE_REGISTRATION,
		SYMBOL_TRANSACTION_TYPE.NAMESPACE_METADATA
	],
	RESTRICTION: [
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION
	],
	SECRET: [
		SYMBOL_TRANSACTION_TYPE.SECRET_LOCK,
		SYMBOL_TRANSACTION_TYPE.SECRET_PROOF
	],
	KEY_LINK: [
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_KEY_LINK,
		SYMBOL_TRANSACTION_TYPE.NODE_KEY_LINK,
		SYMBOL_TRANSACTION_TYPE.VOTING_KEY_LINK,
		SYMBOL_TRANSACTION_TYPE.VRF_KEY_LINK
	]
};

const normalizeMosaicId = id => String(id || '').replace(/^0x/i, '').replace(/'/g, '').toUpperCase();
const isMosaicId = id => MOSAIC_ID_PATTERN.test(normalizeMosaicId(id));
const normalizeNamespaceSearchText = text => String(text || '').trim().replace(/\s+/g, '').toLowerCase();
const isNativeMosaicId = id => {
	const normalizedId = normalizeMosaicId(id);
	const nativeMosaicAliasIds = (config.SYMBOL_NATIVE_MOSAIC_ALIAS_IDS || []).map(normalizeMosaicId);

	return normalizedId === normalizeMosaicId(config.NATIVE_MOSAIC_ID) || nativeMosaicAliasIds.includes(normalizedId);
};

const mosaicFromDTO = mosaic => {
	const id = mosaic.id || config.NATIVE_MOSAIC_ID;

	return {
		id,
		name: isNativeMosaicId(id) ? config.NATIVE_MOSAIC_TICKER : id,
		amount: absoluteToRelative(mosaic.amount || 0)
	};
};

const transactionInfoFromDTO = data => {
	const transaction = data.transaction || {};
	const meta = data.meta || {};
	const value = (transaction.mosaics || []).map(mosaicFromDTO);
	const nativeTransfer = value.find(item => isNativeMosaicId(item.id));

	return {
		hash: meta.hash,
		height: Number(meta.height || 0),
		type: transactionTypeMap[transaction.type] || transaction.type,
		sender: transaction.signerAddress
			? hexToSymbolAddress(transaction.signerAddress)
			: publicKeyToSymbolAddress(transaction.signerPublicKey),
		recipient: transaction.recipientAddress ? hexToSymbolAddress(transaction.recipientAddress) : null,
		value,
		amount: nativeTransfer?.amount || 0,
		fee: absoluteToRelative(transaction.maxFee || 0),
		timestamp: symbolTimestampToDate(transaction.deadline || 0),
		message: transaction.message || ''
	};
};

const createTransactionSearchParams = (searchParams = {}) => {
	const filter = { ...searchParams };

	if (filter.types) {
		const matchingTypes = transactionTypeFilterMap[filter.types] || [filter.types];
		const matchingTypeCodes = matchingTypes.map(type => transactionTypeCodeMap[type] || type);
		filter.type = matchingTypeCodes.length === 1 ? matchingTypeCodes[0] : matchingTypeCodes;
		delete filter.types;
	}

	if (filter.from) {
		if (isSymbolPublicKey(filter.from))
			filter.signerPublicKey = filter.from;
		else if (isSymbolAddress(filter.from))
			filter.address = filter.from;

		delete filter.from;
	}

	if (filter.to) {
		filter.recipientAddress = filter.to;
		delete filter.to;
	}

	if (filter.mosaic) {
		filter.transferMosaicId = filter.mosaic;
		delete filter.mosaic;
	}

	return filter;
};

export const fetchTransactionPage = async searchParams => {
	const filter = createTransactionSearchParams(searchParams);
	const path = filter.group === 'unconfirmed' ? 'transactions/unconfirmed' : 'transactions/confirmed';
	delete filter.group;
	const url = createSymbolSearchURL(path, filter, { orderBy: 'id' });
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, transactionInfoFromDTO);
};

export const fetchTransactionInfo = createTryFetchInfoFunction(async hash => {
	const transaction = await fetchSymbolNode(`transactions/confirmed/${hash}`);

	return transactionInfoFromDTO(transaction);
});

export const resolveTransactionBlockSearch = async text => {
	const query = `${text}`.trim();

	if (/^\d+$/.test(query))
		return { height: query };

	throw new Error('INVALID_TRANSACTION_BLOCK_SEARCH_FORMAT');
};

export const resolveTransactionRecipientSearch = async text => {
	const query = `${text}`.trim();

	if (isSymbolAddress(query))
		return { address: query };

	if (isSymbolPublicKey(query))
		return { address: publicKeyToSymbolAddress(query) };

	throw new Error('INVALID_TRANSACTION_RECIPIENT_SEARCH_FORMAT');
};

export const resolveTransactionSignerSearch = async text => {
	const query = `${text}`.trim();

	if (isSymbolAddress(query)) {
		const data = await fetchSymbolNode(`accounts/${query}`);
		const publicKey = data.account?.publicKey;

		if (isSymbolPublicKey(publicKey) && publicKey !== ZERO_PUBLIC_KEY)
			return {
				address: query,
				value: publicKey
			};

		throw new Error('TRANSACTION_SIGNER_PUBLIC_KEY_NOT_FOUND');
	}

	if (isSymbolPublicKey(query))
		return {
			address: publicKeyToSymbolAddress(query),
			value: query
		};

	throw new Error('INVALID_TRANSACTION_SIGNER_SEARCH_FORMAT');
};

export const resolveTransactionMosaicSearch = async text => {
	const query = `${text}`.trim();

	if (isMosaicId(query)) {
		const mosaicId = normalizeMosaicId(query);

		return {
			id: mosaicId,
			name: mosaicId
		};
	}

	const namespaceName = normalizeNamespaceSearchText(query);
	if (!namespaceName)
		throw new Error('INVALID_TRANSACTION_MOSAIC_SEARCH_FORMAT');

	const namespaceId = await namespaceIdFromName(namespaceName);
	const namespacePath = isMosaicId(namespaceId) ? namespaceId : encodeURIComponent(namespaceName);
	let data;
	try {
		data = await fetchSymbolNode(`namespaces/${namespacePath}`);
	} catch (error) {
		const status = error.response?.status || error.response?.data?.status;
		if ([400, 404, 409].includes(status))
			throw new Error('TRANSACTION_MOSAIC_ALIAS_NOT_FOUND');

		throw error;
	}

	const alias = data.namespace?.alias || {};
	const mosaicId = normalizeMosaicId(alias.mosaicId);

	if (Number(alias.type) === MOSAIC_ALIAS_TYPE && isMosaicId(mosaicId))
		return {
			id: mosaicId,
			name: namespaceName
		};

	throw new Error('TRANSACTION_MOSAIC_ALIAS_NOT_FOUND');
};
