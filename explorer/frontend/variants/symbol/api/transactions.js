import { restrictionTypeLabels } from './mosaicRestrictions';
import { namespaceIdFromName } from './namespaces';
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
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

const ZERO_PUBLIC_KEY = '0'.repeat(64);
const MOSAIC_ID_PATTERN = /^[0-9A-Fa-f]{16}$/;
const TRANSACTION_HASH_PATTERN = /^[0-9A-Fa-f]{64}$/;
const ALIAS_ACTION = {
	UNLINK: 0,
	LINK: 1
};
const LINK_ACTION = {
	UNLINK: 0,
	LINK: 1
};
const MOSAIC_SUPPLY_CHANGE_ACTION = {
	DECREASE: 0,
	INCREASE: 1
};
const MOSAIC_FLAG = {
	SUPPLY_MUTABLE: 1,
	TRANSFERABLE: 2,
	RESTRICTABLE: 4,
	REVOKABLE: 8
};
const ACCOUNT_RESTRICTION_FLAG = {
	ADDRESS: 1,
	MOSAIC_ID: 2,
	TRANSACTION_TYPE: 4,
	OUTGOING: 16384,
	BLOCK: 32768
};
const NAMESPACE_REGISTRATION_TYPE = {
	ROOT: 0,
	SUB: 1
};
const MOSAIC_ALIAS_TYPE = 1;
const SELF_REFERENCE_MOSAIC_ID = '0000000000000000';
const SYMBOL_MESSAGE_TYPE = {
	PLAIN: 'plain',
	ENCRYPTED: 'encrypted',
	DELEGATED_HARVESTING_PERSISTENT: 'delegatedHarvestingPersistent',
	RAW: 'raw'
};
const SECRET_LOCK_HASH_ALGORITHM = {
	0: 'sha3256',
	1: 'hash160',
	2: 'hash256'
};
const DELEGATED_HARVESTING_PERSISTENT_MARKER = 'FE2A8061577301E2';
const DELEGATED_HARVESTING_PERSISTENT_PAYLOAD_LENGTH = 264;
const absoluteToRelativeByDivisibility = (amount, divisibility = config.NATIVE_MOSAIC_DIVISIBILITY) =>
	Number(amount || 0) / Math.pow(10, Number(divisibility ?? config.NATIVE_MOSAIC_DIVISIBILITY) || 0);
export const SYMBOL_TRANSACTION_TYPE = {
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
const normalizeHash = hash => String(hash || '').trim().toUpperCase();
export const isValidTransactionHash = hash => TRANSACTION_HASH_PATTERN.test(normalizeHash(hash));
const isMosaicId = id => MOSAIC_ID_PATTERN.test(normalizeMosaicId(id));
const normalizeNamespaceSearchText = text => String(text || '').trim().replace(/\s+/g, '').toLowerCase();
const isNativeMosaicId = id => normalizeMosaicId(id) === normalizeMosaicId(config.NATIVE_MOSAIC_ID);

const hexToBytes = hex => {
	const normalizedHex = `${hex || ''}`.replace(/\s+/g, '');
	if (!normalizedHex || normalizedHex.length % 2 || /[^0-9A-Fa-f]/.test(normalizedHex))
		return new Uint8Array();

	return new Uint8Array(normalizedHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
};

const decodeMessagePayload = payload => new TextDecoder().decode(hexToBytes(payload));

const getMessagePayload = message => {
	if (typeof message === 'string')
		return message;

	return message?.payload || '';
};

const normalizeMessagePayload = payload => `${payload || ''}`.replace(/^0x/i, '').replace(/\s+/g, '').toUpperCase();

const messageFromDTO = message => {
	if (!message)
		return '';

	const payload = normalizeMessagePayload(getMessagePayload(message));
	if (!payload)
		return '';

	if (['00', '01'].includes(payload))
		return '';

	if (
		payload.length === DELEGATED_HARVESTING_PERSISTENT_PAYLOAD_LENGTH
		&& payload.startsWith(DELEGATED_HARVESTING_PERSISTENT_MARKER)
	)
	{return {
		type: SYMBOL_MESSAGE_TYPE.DELEGATED_HARVESTING_PERSISTENT,
		text: payload
	};}

	const marker = payload.slice(0, 2);

	if (marker === '00')
	{return {
		type: SYMBOL_MESSAGE_TYPE.PLAIN,
		text: decodeMessagePayload(payload.slice(2))
	};}

	if (marker === '01')
	{return {
		type: SYMBOL_MESSAGE_TYPE.ENCRYPTED
	};}

	return {
		type: SYMBOL_MESSAGE_TYPE.RAW,
		text: payload
	};
};

const mosaicFromDTO = (mosaic, divisibility) => {
	const id = mosaic.id || config.NATIVE_MOSAIC_ID;
	const amount = mosaic.amount === undefined || mosaic.amount === null
		? null
		: absoluteToRelativeByDivisibility(mosaic.amount, divisibility);

	return {
		id,
		name: isNativeMosaicId(id) ? config.NATIVE_MOSAIC_TICKER : id,
		amount
	};
};

const aliasActionFromDTO = aliasAction => {
	const action = Number(aliasAction);

	if (action === ALIAS_ACTION.LINK)
		return 'link';

	if (action === ALIAS_ACTION.UNLINK)
		return 'unlink';

	return '';
};

const linkActionFromDTO = linkAction => {
	const action = Number(linkAction);

	if (action === LINK_ACTION.LINK)
		return 'link';

	if (action === LINK_ACTION.UNLINK)
		return 'unlink';

	return '';
};

const secretLockHashAlgorithmFromDTO = hashAlgorithm =>
	SECRET_LOCK_HASH_ALGORITHM[Number(hashAlgorithm)] || `${hashAlgorithm || ''}`;
const restrictionTypeLabelFromDTO = restrictionType => restrictionTypeLabels[Number(restrictionType)] || `${restrictionType || ''}`;

const accountRestrictionTypeLabelFromDTO = restrictionFlags => {
	const flags = Number(restrictionFlags || 0);
	const direction = flags & ACCOUNT_RESTRICTION_FLAG.OUTGOING ? 'Outgoing' : 'Incoming';
	const mode = flags & ACCOUNT_RESTRICTION_FLAG.BLOCK ? 'Block' : 'Allow';

	if (flags & ACCOUNT_RESTRICTION_FLAG.ADDRESS)
		return `${mode} ${direction} Address`;

	if (flags & ACCOUNT_RESTRICTION_FLAG.MOSAIC_ID)
		return `${mode} ${direction} Mosaic`;

	if (flags & ACCOUNT_RESTRICTION_FLAG.TRANSACTION_TYPE)
		return `${mode} ${direction} Operation`;

	return `${restrictionFlags || ''}`;
};

const accountRestrictionOperationValuesFromDTO = values => (values || [])
	.map(value => transactionTypeMap[value] || transactionTypeMap[Number(value)] || `${value}`);

const supplyActionFromDTO = (transaction, type) => {
	if (type !== SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE)
		return '';

	const action = Number(transaction.action);

	if (action === MOSAIC_SUPPLY_CHANGE_ACTION.INCREASE)
		return 'increase';

	if (action === MOSAIC_SUPPLY_CHANGE_ACTION.DECREASE)
		return 'decrease';

	return '';
};

const mosaicDefinitionFlagFromDTO = (flags, key, mask) => {
	if (typeof flags === 'object' && flags !== null)
		return flags[key];

	return !!(Number(flags || 0) & mask);
};

const mosaicNonceFromDTO = nonce => {
	if (nonce === undefined || nonce === null)
		return undefined;

	if (typeof nonce?.toJson === 'function')
		return nonce.toJson();

	if (nonce?.value !== undefined)
		return nonce.value;

	return nonce;
};

const restrictionActionFromDTO = (transaction, type) => {
	if (![
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION,
		SYMBOL_TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION
	].includes(type))
		return null;

	const added = transaction.restrictionAdditions?.length || 0;
	const removed = transaction.restrictionDeletions?.length || 0;

	if (!added && !removed)
		return null;

	return {
		added,
		removed
	};
};

const namespaceRegistrationFromDTO = (transaction, type) => {
	if (type !== SYMBOL_TRANSACTION_TYPE.NAMESPACE_REGISTRATION || !transaction.name)
		return null;

	const registrationType = Number(transaction.registrationType) === NAMESPACE_REGISTRATION_TYPE.SUB ? 'sub' : 'root';

	return {
		id: transaction.id,
		name: transaction.name,
		registrationType
	};
};

const proofFromDTO = (transaction, type) => {
	if (type !== SYMBOL_TRANSACTION_TYPE.SECRET_PROOF)
		return null;

	return transaction.proof || null;
};

const secretFromDTO = (transaction, type) => {
	if (type !== SYMBOL_TRANSACTION_TYPE.SECRET_LOCK)
		return null;

	return transaction.secret || null;
};

const mosaicsFromDTO = (transaction, type) => {
	if (type === SYMBOL_TRANSACTION_TYPE.HASH_LOCK && transaction.mosaicId)
	{return [
		{
			id: transaction.mosaicId,
			amount: transaction.amount
		}
	];}

	if (type === SYMBOL_TRANSACTION_TYPE.HASH_LOCK && transaction.mosaic)
		return [transaction.mosaic];

	if (type === SYMBOL_TRANSACTION_TYPE.MOSAIC_DEFINITION && transaction.id)
	{return [
		{
			id: transaction.id
		}
	];}

	if (type === SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION && transaction.mosaicId)
	{return [
		{
			id: transaction.mosaicId
		}
	];}

	if (type === SYMBOL_TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION && transaction.mosaicId)
	{return [
		{
			id: transaction.mosaicId
		}
	];}

	return transaction.mosaics || [];
};

const transactionInfoFromDTO = (data, mosaicDivisibilityMap = {}) => {
	const transaction = data.transaction || {};
	const meta = data.meta || {};
	const type = transactionTypeMap[transaction.type] || transaction.type;
	const mosaics = mosaicsFromDTO(transaction, type);
	const value = mosaics.map(mosaic => {
		const mosaicId = mosaic.id || config.NATIVE_MOSAIC_ID;
		const divisibility = Object.prototype.hasOwnProperty.call(mosaicDivisibilityMap, mosaicId)
			? mosaicDivisibilityMap[mosaicId]
			: undefined;

		return mosaicFromDTO(mosaic, divisibility);
	});
	const nativeTransfer = value.find(item => isNativeMosaicId(item.id));
	const aliasAction = aliasActionFromDTO(transaction.aliasAction);
	const linkAction = linkActionFromDTO(transaction.linkAction);
	const supplyAction = supplyActionFromDTO(transaction, type);
	const restrictionAction = restrictionActionFromDTO(transaction, type);
	const namespaceRegistration = namespaceRegistrationFromDTO(transaction, type);
	const proof = proofFromDTO(transaction, type);
	const secret = secretFromDTO(transaction, type);

	return {
		hash: meta.hash || meta.aggregateHash,
		height: Number(meta.height || 0),
		type,
		sender: transaction.signerAddress
			? hexToSymbolAddress(transaction.signerAddress)
			: publicKeyToSymbolAddress(transaction.signerPublicKey),
		recipient: transaction.recipientAddress ? hexToSymbolAddress(transaction.recipientAddress) : null,
		value,
		amount: nativeTransfer?.amount || 0,
		fee: absoluteToRelative(transaction.maxFee || 0),
		timestamp: symbolTimestampToDate(transaction.deadline || 0),
		...(aliasAction && { aliasAction }),
		...(linkAction && { linkAction }),
		...(supplyAction && { supplyAction }),
		...(restrictionAction && { restrictionAction }),
		...(namespaceRegistration && { namespaceRegistration }),
		...(proof && { proof }),
		...(secret && { secret }),
		message: messageFromDTO(transaction.message)
	};
};

const createTransactionSearchParams = (searchParams = {}) => {
	const filter = { ...searchParams };

	delete filter.mosaicDivisibility;

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
		filter.embedded = 'true';
		delete filter.mosaic;
	}

	return filter;
};

export const fetchTransactionPage = async searchParams => {
	const filter = createTransactionSearchParams(searchParams);
	const path = filter.group === 'unconfirmed' ? 'transactions/unconfirmed' : 'transactions/confirmed';
	const mosaicDivisibilityMap = filter.transferMosaicId && searchParams?.mosaicDivisibility !== undefined
		? { [filter.transferMosaicId]: searchParams.mosaicDivisibility }
		: {};
	delete filter.group;
	const url = createSymbolSearchURL(path, filter, { orderBy: 'id' });
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, data => transactionInfoFromDTO(data, mosaicDivisibilityMap));
};

const getTransactionDTO = data => data?.transaction ? data : { transaction: data || {}, meta: data?.meta || {} };

const relativeNativeAmount = amount => {
	if (amount === undefined || amount === null)
		return null;

	return absoluteToRelative(amount);
};

const normalizedMosaicFromDTO = (mosaic, mosaicDivisibilityMap = {}) => {
	const mosaicId = mosaic?.mosaicId || mosaic?.id || config.NATIVE_MOSAIC_ID;
	const amount = mosaic?.amount;
	const divisibility = Object.prototype.hasOwnProperty.call(mosaicDivisibilityMap, mosaicId)
		? mosaicDivisibilityMap[mosaicId]
		: undefined;

	return {
		mosaicId,
		id: mosaicId,
		name: isNativeMosaicId(mosaicId) ? config.NATIVE_MOSAIC_TICKER : mosaicId,
		amount: amount === undefined || amount === null ? null : absoluteToRelativeByDivisibility(amount, divisibility),
		rawAmount: amount === undefined || amount === null ? null : `${amount}`
	};
};

const normalizedMosaicsFromDTO = (mosaics, mosaicDivisibilityMap = {}) => (Array.isArray(mosaics) ? mosaics : [])
	.map(mosaic => normalizedMosaicFromDTO(mosaic, mosaicDivisibilityMap));

const addressFromDTO = value => {
	if (!value)
		return value;

	return hexToSymbolAddress(value);
};

const signerFromDTO = transaction => transaction.signerAddress
	? hexToSymbolAddress(transaction.signerAddress)
	: publicKeyToSymbolAddress(transaction.signerPublicKey);

const normalizeTransactionGroup = group => {
	const normalizedGroup = `${group || ''}`.toLowerCase();

	if (['confirmed', 'unconfirmed', 'partial', 'failed'].includes(normalizedGroup))
		return normalizedGroup;

	return normalizedGroup || 'unknown';
};

const fetchTransactionStatus = async hash => fetchSymbolNode(`transactionStatus/${hash}`);

const fetchTransactionByGroup = async (hash, group) => {
	const normalizedGroup = normalizeTransactionGroup(group);
	const pathMap = {
		confirmed: `transactions/confirmed/${hash}`,
		unconfirmed: `transactions/unconfirmed/${hash}`,
		partial: `transactions/partial/${hash}`
	};
	const path = pathMap[normalizedGroup];

	if (!path)
		return null;

	return fetchSymbolNode(path);
};

const tryFetchBlockInfo = async height => {
	if (!height)
		return null;

	try {
		return await fetchSymbolNode(`blocks/${height}`);
	} catch {
		return null;
	}
};

const tryFetchHashLock = async hash => {
	try {
		return await fetchSymbolNode(`lock/hash/${hash}`);
	} catch {
		return null;
	}
};

const tryFetchNamespaceNames = async namespaceIds => {
	const uniqueNamespaceIds = [...new Set(namespaceIds.filter(namespaceId => !!namespaceId))];

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
	} catch {
		return {};
	}
};

const collectSupplyRevocationMosaicIds = transaction => {
	const type = transactionTypeMap[transaction.type] || transaction.type;
	const embeddedTransactions = transaction.transactions || transaction.embeddedTransactions || [];
	const mosaicIds = type === SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION && transaction.mosaicId
		? [transaction.mosaicId]
		: [];

	embeddedTransactions.forEach(embeddedTransaction => {
		mosaicIds.push(...collectSupplyRevocationMosaicIds(embeddedTransaction.transaction || embeddedTransaction));
	});

	return mosaicIds;
};

const tryFetchMosaicDivisibilityMap = async mosaicIds => {
	const uniqueMosaicIds = [...new Set(mosaicIds)].filter(id => MOSAIC_ID_PATTERN.test(`${id || ''}`));
	const entries = await Promise.all(uniqueMosaicIds.map(async mosaicId => {
		try {
			const data = await fetchSymbolNode(`mosaics/${mosaicId}`);
			const divisibility = data?.mosaic?.divisibility;

			return [mosaicId, Number(divisibility || 0)];
		} catch {
			return null;
		}
	}));

	return Object.fromEntries(entries.filter(entry => !!entry));
};

const calculateEffectiveFee = (transaction, meta, blockDTO) => {
	const size = Number(transaction.size || meta.size || 0);
	const feeMultiplier = Number(meta.feeMultiplier || transaction.feeMultiplier || blockDTO?.block?.feeMultiplier || 0);

	return size && feeMultiplier ? relativeNativeAmount(size * feeMultiplier) : null;
};

const normalizeTransactionInfo = ({ hash, status, transactionDto, blockDto }) => {
	const dto = getTransactionDTO(transactionDto);
	const transaction = dto.transaction || {};
	const meta = dto.meta || {};
	const group = normalizeTransactionGroup(status?.group);
	const isConfirmed = group === 'confirmed';
	const height = Number(meta.height || status?.height || 0);
	const effectiveFee = isConfirmed ? calculateEffectiveFee(transaction, meta, blockDto) : null;
	const maxFee = !isConfirmed ? relativeNativeAmount(transaction.maxFee || transaction.fee) : null;

	return {
		transactionHash: meta.hash || status?.hash || hash,
		status: status?.code,
		confirm: group,
		blockHeight: height || undefined,
		timestamp: meta.timestamp
			? symbolTimestampToDate(meta.timestamp)
			: blockDto?.block?.timestamp
				? symbolTimestampToDate(blockDto.block.timestamp)
				: undefined,
		deadline: transaction.deadline ? symbolTimestampToDate(transaction.deadline) : undefined,
		signer: signerFromDTO(transaction),
		payloadSize: Number(transaction.size || meta.size || 0) || undefined,
		effectiveFee,
		maxFee,
		signature: transaction.signature,
		version: transaction.version
	};
};

const addIfPresent = (target, key, value) => {
	if (value !== undefined && value !== null && value !== '')
		target[key] = value;
};

const normalizeMetadataValue = transaction => transaction.value || transaction.valueChange || transaction.valueChangeDelta || '';

const isTargetAccountAddressKeyLink = type => [
	SYMBOL_TRANSACTION_TYPE.ACCOUNT_KEY_LINK,
	SYMBOL_TRANSACTION_TYPE.NODE_KEY_LINK,
	SYMBOL_TRANSACTION_TYPE.VOTING_KEY_LINK,
	SYMBOL_TRANSACTION_TYPE.VRF_KEY_LINK
].includes(type);

const linkedAccountAddressFromKeyLinkDTO = (transaction, type, linkedPublicKey) => {
	if (transaction.linkedAccountAddress)
		return addressFromDTO(transaction.linkedAccountAddress);

	if (isTargetAccountAddressKeyLink(type) && isSymbolPublicKey(linkedPublicKey))
		return publicKeyToSymbolAddress(linkedPublicKey);

	if (isTargetAccountAddressKeyLink(type))
		return signerFromDTO(transaction);
};

const normalizeKeyLinkBody = (transaction, type) => {
	const body = { transactionType: type };
	const linkedPublicKey = transaction.linkedPublicKey || transaction.publicKey || transaction.vrfKey || transaction.votingPublicKey;
	const linkedAccountAddress = linkedAccountAddressFromKeyLinkDTO(transaction, type, linkedPublicKey);

	addIfPresent(body, 'linkAction', linkActionFromDTO(transaction.linkAction));
	addIfPresent(body, 'linkedPublicKey', linkedPublicKey);
	addIfPresent(body, 'linkedAccountAddress', linkedAccountAddress);
	if (isTargetAccountAddressKeyLink(type))
		addIfPresent(body, 'address', linkedAccountAddress);
	addIfPresent(body, 'startEpoch', transaction.startEpoch);
	addIfPresent(body, 'endEpoch', transaction.endEpoch);

	return body;
};

const normalizeTransactionBody = (transaction, mosaicDivisibilityMap = {}) => {
	const type = transactionTypeMap[transaction.type] || transaction.type;
	const body = { transactionType: type };

	switch (type) {
	case SYMBOL_TRANSACTION_TYPE.TRANSFER:
		addIfPresent(body, 'recipient', addressFromDTO(transaction.recipientAddress));
		addIfPresent(body, 'mosaics', normalizedMosaicsFromDTO(transaction.mosaics, mosaicDivisibilityMap));
		addIfPresent(body, 'message', messageFromDTO(transaction.message));
		break;
	case SYMBOL_TRANSACTION_TYPE.NAMESPACE_REGISTRATION:
		addIfPresent(body, 'recipient', addressFromDTO(transaction.rentalFeeSink || transaction.recipientAddress));
		addIfPresent(body, 'registrationType', Number(transaction.registrationType) === NAMESPACE_REGISTRATION_TYPE.SUB ? 'sub' : 'root');
		addIfPresent(body, 'namespaceName', transaction.name);
		addIfPresent(body, 'namespaceId', transaction.id);
		addIfPresent(body, 'parentId', transaction.parentId);
		addIfPresent(body, 'duration', transaction.duration);
		break;
	case SYMBOL_TRANSACTION_TYPE.ADDRESS_ALIAS:
		addIfPresent(body, 'aliasAction', aliasActionFromDTO(transaction.aliasAction));
		addIfPresent(body, 'namespaceId', transaction.namespaceId);
		addIfPresent(body, 'namespaceName', transaction.namespaceName);
		addIfPresent(body, 'address', addressFromDTO(transaction.address));
		break;
	case SYMBOL_TRANSACTION_TYPE.MOSAIC_ALIAS:
		addIfPresent(body, 'aliasAction', aliasActionFromDTO(transaction.aliasAction));
		addIfPresent(body, 'namespaceId', transaction.namespaceId);
		addIfPresent(body, 'namespaceName', transaction.namespaceName);
		addIfPresent(body, 'mosaicId', transaction.mosaicId);
		break;
	case SYMBOL_TRANSACTION_TYPE.MOSAIC_DEFINITION:
		addIfPresent(body, 'recipient', addressFromDTO(transaction.rentalFeeSink || transaction.recipientAddress));
		addIfPresent(body, 'mosaicId', transaction.id);
		addIfPresent(body, 'divisibility', transaction.divisibility);
		addIfPresent(body, 'duration', transaction.duration);
		addIfPresent(body, 'nonce', mosaicNonceFromDTO(transaction.nonce));
		addIfPresent(body, 'supplyMutable', mosaicDefinitionFlagFromDTO(
			transaction.flags,
			'supplyMutable',
			MOSAIC_FLAG.SUPPLY_MUTABLE
		));
		addIfPresent(body, 'transferable', mosaicDefinitionFlagFromDTO(
			transaction.flags,
			'transferable',
			MOSAIC_FLAG.TRANSFERABLE
		));
		addIfPresent(body, 'restrictable', mosaicDefinitionFlagFromDTO(
			transaction.flags,
			'restrictable',
			MOSAIC_FLAG.RESTRICTABLE
		));
		addIfPresent(body, 'revokable', mosaicDefinitionFlagFromDTO(
			transaction.flags,
			'revokable',
			MOSAIC_FLAG.REVOKABLE
		));
		break;
	case SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE:
		addIfPresent(body, 'mosaicId', transaction.mosaicId);
		addIfPresent(body, 'action', supplyActionFromDTO(transaction, type));
		addIfPresent(body, 'delta', transaction.delta);
		break;
	case SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION:
		addIfPresent(body, 'address', addressFromDTO(transaction.sourceAddress || transaction.targetAddress));
		addIfPresent(body, 'mosaics', normalizedMosaicsFromDTO(
			[{ id: transaction.mosaicId, amount: transaction.amount }],
			mosaicDivisibilityMap
		));
		break;
	case SYMBOL_TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION:
		addIfPresent(body, 'minApprovalDelta', transaction.minApprovalDelta);
		addIfPresent(body, 'minRemovalDelta', transaction.minRemovalDelta);
		addIfPresent(body, 'addressAdditions', (transaction.addressAdditions || []).map(addressFromDTO));
		addIfPresent(body, 'addressDeletions', (transaction.addressDeletions || []).map(addressFromDTO));
		break;
	case SYMBOL_TRANSACTION_TYPE.HASH_LOCK:
		addIfPresent(body, 'duration', transaction.duration);
		addIfPresent(body, 'mosaics', normalizedMosaicsFromDTO([{ id: transaction.mosaicId, amount: transaction.amount }]));
		addIfPresent(body, 'hash', transaction.hash);
		break;
	case SYMBOL_TRANSACTION_TYPE.SECRET_LOCK:
		addIfPresent(body, 'duration', transaction.duration);
		addIfPresent(body, 'mosaics', normalizedMosaicsFromDTO([{ id: transaction.mosaicId, amount: transaction.amount }]));
		addIfPresent(body, 'secret', transaction.secret);
		addIfPresent(body, 'recipient', addressFromDTO(transaction.recipientAddress));
		addIfPresent(body, 'hashAlgorithm', secretLockHashAlgorithmFromDTO(transaction.hashAlgorithm));
		break;
	case SYMBOL_TRANSACTION_TYPE.SECRET_PROOF:
		addIfPresent(body, 'hashAlgorithm', secretLockHashAlgorithmFromDTO(transaction.hashAlgorithm));
		addIfPresent(body, 'recipient', addressFromDTO(transaction.recipientAddress));
		addIfPresent(body, 'secret', transaction.secret);
		addIfPresent(body, 'proof', transaction.proof);
		break;
	case SYMBOL_TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION:
		addIfPresent(body, 'restrictionType', accountRestrictionTypeLabelFromDTO(transaction.restrictionFlags));
		addIfPresent(body, 'restrictionAddressAdditions', (transaction.restrictionAdditions || []).map(addressFromDTO));
		addIfPresent(body, 'restrictionAddressDeletions', (transaction.restrictionDeletions || []).map(addressFromDTO));
		break;
	case SYMBOL_TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION:
		addIfPresent(body, 'restrictionType', accountRestrictionTypeLabelFromDTO(transaction.restrictionFlags));
		addIfPresent(body, 'restrictionMosaicAdditions', transaction.restrictionAdditions);
		addIfPresent(body, 'restrictionMosaicDeletions', transaction.restrictionDeletions);
		break;
	case SYMBOL_TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION:
		addIfPresent(body, 'restrictionType', accountRestrictionTypeLabelFromDTO(transaction.restrictionFlags));
		addIfPresent(body, 'restrictionOperationAdditions', accountRestrictionOperationValuesFromDTO(transaction.restrictionAdditions));
		addIfPresent(body, 'restrictionOperationDeletions', accountRestrictionOperationValuesFromDTO(transaction.restrictionDeletions));
		break;
	case SYMBOL_TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION:
		addIfPresent(body, 'mosaicId', transaction.mosaicId);
		addIfPresent(body, 'mosaicAliasNames', transaction.mosaicAliasNames);
		addIfPresent(body, 'targetAddress', addressFromDTO(transaction.targetAddress));
		addIfPresent(body, 'restrictionKey', transaction.restrictionKey);
		addIfPresent(body, 'previousRestrictionValue', transaction.previousRestrictionValue);
		addIfPresent(body, 'newRestrictionValue', transaction.newRestrictionValue);
		break;
	case SYMBOL_TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION:
	{
		const referenceMosaicId = transaction.referenceMosaicId === SELF_REFERENCE_MOSAIC_ID
			? transaction.mosaicId
			: transaction.referenceMosaicId || transaction.mosaicId;

		addIfPresent(body, 'mosaicId', transaction.mosaicId);
		addIfPresent(body, 'referenceMosaicId', referenceMosaicId);
		addIfPresent(body, 'mosaicAliasNames', transaction.mosaicAliasNames);
		addIfPresent(body, 'restrictionKey', transaction.restrictionKey);
		addIfPresent(body, 'previousRestrictionType', restrictionTypeLabelFromDTO(transaction.previousRestrictionType));
		addIfPresent(body, 'previousRestrictionValue', transaction.previousRestrictionValue);
		addIfPresent(body, 'newRestrictionType', restrictionTypeLabelFromDTO(transaction.newRestrictionType));
		addIfPresent(body, 'newRestrictionValue', transaction.newRestrictionValue);
		break;
	}
	case SYMBOL_TRANSACTION_TYPE.ACCOUNT_METADATA:
	case SYMBOL_TRANSACTION_TYPE.MOSAIC_METADATA:
	case SYMBOL_TRANSACTION_TYPE.NAMESPACE_METADATA:
		addIfPresent(body, 'scopedMetadataKey', transaction.scopedMetadataKey);
		addIfPresent(body, 'targetAddress', addressFromDTO(transaction.targetAddress));
		addIfPresent(body, 'targetMosaicId', transaction.targetMosaicId);
		addIfPresent(body, 'targetMosaicAliasNames', transaction.targetMosaicAliasNames);
		addIfPresent(body, 'targetNamespaceId', transaction.targetNamespaceId);
		addIfPresent(body, 'namespaceName', transaction.namespaceName);
		addIfPresent(body, 'valueDelta', normalizeMetadataValue(transaction));
		addIfPresent(body, 'valueSizeDelta', transaction.valueSizeDelta);
		break;
	case SYMBOL_TRANSACTION_TYPE.ACCOUNT_KEY_LINK:
	case SYMBOL_TRANSACTION_TYPE.NODE_KEY_LINK:
	case SYMBOL_TRANSACTION_TYPE.VOTING_KEY_LINK:
	case SYMBOL_TRANSACTION_TYPE.VRF_KEY_LINK:
		return normalizeKeyLinkBody(transaction, type);
	default:
		break;
	}

	return body;
};

const normalizeGraphicTransaction = (transaction, mosaicDivisibilityMap = {}) => {
	const type = transactionTypeMap[transaction.type] || transaction.type;
	const body = normalizeTransactionBody(transaction, mosaicDivisibilityMap);
	const { recipient: bodyRecipient } = body;
	const signer = signerFromDTO(transaction);
	const sender = type === SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION ? body.address : signer;
	let recipient = bodyRecipient;

	if (type === SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION)
		recipient = signer;
	else if (type === SYMBOL_TRANSACTION_TYPE.ADDRESS_ALIAS)
		recipient = body.address;
	else if (type === SYMBOL_TRANSACTION_TYPE.NAMESPACE_REGISTRATION)
		recipient = undefined;

	return {
		type,
		sender,
		recipient,
		address: body.address,
		targetAccount: [
			SYMBOL_TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION,
			SYMBOL_TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION,
			SYMBOL_TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION
		].includes(type) ? signer : body.linkedAccountAddress,
		targetMosaic: body.mosaicId || (type === SYMBOL_TRANSACTION_TYPE.MOSAIC_METADATA && body.targetMosaicId)
			? {
				id: body.mosaicId || body.targetMosaicId,
				name: body.mosaicId || body.targetMosaicId
			}
			: null,
		targetNamespace: type === SYMBOL_TRANSACTION_TYPE.NAMESPACE_REGISTRATION && body.namespaceId
			? {
				id: body.namespaceId,
				name: body.namespaceName || body.namespaceId
			}
			: type === SYMBOL_TRANSACTION_TYPE.NAMESPACE_METADATA && body.targetNamespaceId
				? {
					id: body.targetNamespaceId,
					name: body.targetNamespaceId
				}
				: null,
		registrationType: body.registrationType,
		parentId: body.parentId,
		referenceMosaicId: body.referenceMosaicId,
		mosaicAliasNames: body.mosaicAliasNames,
		targetMosaicAliasNames: body.targetMosaicAliasNames,
		targetAddress: body.targetAddress,
		targetNamespaceId: body.targetNamespaceId,
		restrictionKey: body.restrictionKey,
		previousRestrictionType: body.previousRestrictionType,
		previousRestrictionValue: body.previousRestrictionValue,
		newRestrictionType: body.newRestrictionType,
		newRestrictionValue: body.newRestrictionValue,
		restrictionType: body.restrictionType,
		restrictionAddressAdditions: body.restrictionAddressAdditions,
		restrictionAddressDeletions: body.restrictionAddressDeletions,
		restrictionMosaicAdditions: body.restrictionMosaicAdditions,
		restrictionMosaicDeletions: body.restrictionMosaicDeletions,
		restrictionOperationAdditions: body.restrictionOperationAdditions,
		restrictionOperationDeletions: body.restrictionOperationDeletions,
		aliasAction: [
			SYMBOL_TRANSACTION_TYPE.ADDRESS_ALIAS,
			SYMBOL_TRANSACTION_TYPE.MOSAIC_ALIAS
		].includes(type) ? body.aliasAction : undefined,
		namespaceId: [
			SYMBOL_TRANSACTION_TYPE.ADDRESS_ALIAS,
			SYMBOL_TRANSACTION_TYPE.MOSAIC_ALIAS
		].includes(type) ? body.namespaceId : undefined,
		namespaceName: [
			SYMBOL_TRANSACTION_TYPE.ADDRESS_ALIAS,
			SYMBOL_TRANSACTION_TYPE.MOSAIC_ALIAS,
			SYMBOL_TRANSACTION_TYPE.NAMESPACE_METADATA
		].includes(type) ? body.namespaceName : undefined,
		mosaicId: type === SYMBOL_TRANSACTION_TYPE.MOSAIC_ALIAS ? body.mosaicId : undefined,
		mosaics: body.mosaics?.map(mosaic => ({
			id: mosaic.mosaicId,
			name: mosaic.name,
			amount: mosaic.amount
		})),
		message: body.message,
		minApprovalDelta: body.minApprovalDelta,
		minRemovalDelta: body.minRemovalDelta,
		cosignatoryAdditions: body.addressAdditions,
		cosignatoryDeletions: body.addressDeletions,
		divisibility: body.divisibility,
		duration: body.duration,
		nonce: body.nonce,
		supplyMutable: body.supplyMutable,
		transferable: body.transferable,
		restrictable: body.restrictable,
		revokable: body.revokable,
		hash: body.hash,
		lockDuration: type === SYMBOL_TRANSACTION_TYPE.HASH_LOCK ? body.duration : undefined,
		hashAlgorithm: body.hashAlgorithm,
		secret: body.secret,
		proof: body.proof,
		delta: body.delta,
		supplyAction: body.action === 'increase' ? 1 : body.action === 'decrease' ? 2 : undefined,
		keyLinkAction: body.linkAction === 'link' ? 1 : body.linkAction === 'unlink' ? 2 : undefined,
		publicKey: body.linkedPublicKey,
		startEpoch: body.startEpoch,
		endEpoch: body.endEpoch,
		scopedMetadataKey: body.scopedMetadataKey,
		valueDelta: body.valueDelta,
		valueSizeDelta: body.valueSizeDelta
	};
};

const normalizeAggregate = (transaction, mosaicDivisibilityMap = {}) => {
	const embeddedTransactions = transaction.transactions || transaction.embeddedTransactions || [];
	const innerTransactions = embeddedTransactions.map((embeddedTransaction, index) => {
		const embedded = embeddedTransaction.transaction || embeddedTransaction;
		const body = normalizeTransactionBody(embedded, mosaicDivisibilityMap);

		return {
			index,
			signer: signerFromDTO(embedded),
			transactionType: body.transactionType,
			detail: body,
			graphic: normalizeGraphicTransaction(embedded, mosaicDivisibilityMap)
		};
	});
	const cosignatures = (transaction.cosignatures || []).map(cosignature => ({
		signature: cosignature.signature,
		signer: cosignature.signerAddress
			? hexToSymbolAddress(cosignature.signerAddress)
			: publicKeyToSymbolAddress(cosignature.signerPublicKey)
	}));

	if (!innerTransactions.length && !cosignatures.length)
		return undefined;

	return {
		innerTransactions,
		cosignatures
	};
};

const hashLockStatuses = {
	0: 'unused',
	1: 'used'
};

const normalizeHashLock = hashLockDto => {
	const lock = hashLockDto?.lock;

	if (!lock)
		return undefined;

	return {
		endHeight: Number(lock.endHeight || 0),
		ownerAddress: addressFromDTO(lock.ownerAddress),
		status: hashLockStatuses[Number(lock.status)] || `${lock.status}`,
		mosaics: normalizedMosaicsFromDTO([{ id: lock.mosaicId, amount: lock.amount }])
	};
};

const omitUndefinedProperties = value => {
	if (Array.isArray(value))
		return value.map(item => item === undefined ? null : omitUndefinedProperties(item));

	if (value && typeof value === 'object')
	{return Object.entries(value).reduce((result, [key, item]) => {
		if (item !== undefined)
			result[key] = omitUndefinedProperties(item);

		return result;
	}, {});}

	return value;
};

const isAliasTransactionType = type => [
	SYMBOL_TRANSACTION_TYPE.ADDRESS_ALIAS,
	SYMBOL_TRANSACTION_TYPE.MOSAIC_ALIAS
].includes(type);

const getNamespaceIdRequiringName = fields => {
	const type = fields?.transactionType || fields?.type;

	if (isAliasTransactionType(type) && fields.namespaceId && !fields.namespaceName)
		return fields.namespaceId;

	if (type === SYMBOL_TRANSACTION_TYPE.NAMESPACE_METADATA && fields.targetNamespaceId && !fields.namespaceName)
		return fields.targetNamespaceId;

	return null;
};

const collectNamespaceIdsRequiringName = transactionInfo => [
	transactionInfo.detail,
	...(transactionInfo.graphic?.transactions || []),
	...(transactionInfo.aggregate?.innerTransactions || []).flatMap(innerTransaction => [
		innerTransaction.detail,
		innerTransaction.graphic
	])
]
	.map(getNamespaceIdRequiringName)
	.filter(namespaceId => !!namespaceId);

const applyNamespaceNames = (fields, namespaceNames) => {
	const namespaceId = getNamespaceIdRequiringName(fields);

	if (namespaceId)
		addIfPresent(fields, 'namespaceName', namespaceNames[namespaceId]);
};

const withResolvedAliasNamespaceNames = async transactionInfo => {
	const namespaceIds = collectNamespaceIdsRequiringName(transactionInfo);
	const namespaceNames = await tryFetchNamespaceNames(namespaceIds);

	applyNamespaceNames(transactionInfo.detail, namespaceNames);
	(transactionInfo.graphic?.transactions || []).forEach(graphicTransaction => applyNamespaceNames(graphicTransaction, namespaceNames));
	(transactionInfo.aggregate?.innerTransactions || []).forEach(innerTransaction => {
		applyNamespaceNames(innerTransaction.detail, namespaceNames);
		applyNamespaceNames(innerTransaction.graphic, namespaceNames);
	});

	return transactionInfo;
};

export const normalizeTransactionDetail = ({
	hash,
	status,
	transactionDto,
	hashLockDto,
	blockDto,
	mosaicDivisibilityMap = {}
}) => {
	const dto = getTransactionDTO(transactionDto);
	const transaction = dto.transaction || {};
	const type = transactionTypeMap[transaction.type] || transaction.type;
	const version = Number(transaction.version || 0);
	const info = normalizeTransactionInfo({ hash, status, transactionDto, blockDto });
	const detail = normalizeTransactionBody(transaction, mosaicDivisibilityMap);
	const aggregate = [
		SYMBOL_TRANSACTION_TYPE.AGGREGATE_COMPLETE,
		SYMBOL_TRANSACTION_TYPE.AGGREGATE_BONDED
	].includes(type)
		? normalizeAggregate(transaction, mosaicDivisibilityMap)
		: undefined;
	const hashLock = type === SYMBOL_TRANSACTION_TYPE.AGGREGATE_BONDED
		? normalizeHashLock(hashLockDto)
		: undefined;
	const graphicTransactions = aggregate?.innerTransactions.length
		? aggregate.innerTransactions.map(item => item.graphic)
		: [normalizeGraphicTransaction(transaction, mosaicDivisibilityMap)];

	return {
		hash: info.transactionHash,
		group: normalizeTransactionGroup(status?.group),
		type,
		version,
		info,
		detail,
		aggregate,
		hashLock,
		graphic: {
			transactions: graphicTransactions
		}
	};
};

export const fetchTransactionInfo = createTryFetchInfoFunction(async hash => {
	const normalizedHash = normalizeHash(hash);

	if (!isValidTransactionHash(normalizedHash))
		return null;

	const status = await fetchTransactionStatus(normalizedHash);
	const group = normalizeTransactionGroup(status?.group);
	const transaction = await fetchTransactionByGroup(normalizedHash, group);

	if (!transaction)
		return null;

	const dto = getTransactionDTO(transaction);
	const type = transactionTypeMap[dto.transaction?.type] || dto.transaction?.type;
	const height = Number(dto.meta?.height || status?.height || 0);
	const block = group === 'confirmed' ? await tryFetchBlockInfo(height) : null;
	const hashLock = type === SYMBOL_TRANSACTION_TYPE.AGGREGATE_BONDED ? await tryFetchHashLock(normalizedHash) : null;
	const mosaicDivisibilityMap = await tryFetchMosaicDivisibilityMap(collectSupplyRevocationMosaicIds(dto.transaction || {}));

	const transactionInfo = normalizeTransactionDetail({
		hash: normalizedHash,
		status,
		transactionDto: transaction,
		hashLockDto: hashLock,
		blockDto: block,
		mosaicDivisibilityMap
	});

	return omitUndefinedProperties(await withResolvedAliasNamespaceNames(transactionInfo));
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
		{return {
			address: query,
			value: publicKey
		};}

		throw new Error('TRANSACTION_SIGNER_PUBLIC_KEY_NOT_FOUND');
	}

	if (isSymbolPublicKey(query))
	{return {
		address: publicKeyToSymbolAddress(query),
		value: query
	};}

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
	{return {
		id: mosaicId,
		name: namespaceName
	};}

	throw new Error('TRANSACTION_MOSAIC_ALIAS_NOT_FOUND');
};
