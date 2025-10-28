import { addressFromPublicKey, addressFromRaw } from './account';
import { networkTimestampToUnix } from './helper';
import {
	formatMosaicList,
	getMosaicAmount,
	isRestrictableFlag,
	isRevokableFlag,
	isSupplyMutableFlag,
	isTransferableFlag
} from './mosaic';
import { networkTypeToIdentifier } from './network';
import {
	createFee,
	decodePlainMessage,
	getUnresolvedIdsFromTransactions,
	isAggregateTransaction,
	isIncomingTransaction,
	isOutgoingTransaction
} from './transaction';
import {
	AddressRestrictionFlagMessage,
	AliasActionMessage,
	LinkActionMessage,
	LockHashAlgorithmMessage,
	Message,
	MessageType,
	MosaicRestrictionFlagMessage,
	MosaicRestrictionTypeMessage,
	MosaicSupplyChangeActionMessage,
	NamespaceRegistrationTypeMessage,
	OperationRestrictionFlagMessage,
	TransactionType
} from '../constants';
import { SdkError, absoluteToRelativeAmount, safeOperationWithRelativeAmounts } from 'wallet-common-core';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Account').UnresolvedAddressWithLocation} UnresolvedAddressWithLocation */
/** @typedef {import('../types/Mosaic').Mosaic} Mosaic */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

/**
 * Checks if a transaction DTO is an aggregate transaction.
 * @param {object} transactionDTO - The transaction DTO.
 * @returns {boolean} A boolean indicating whether the transaction is an aggregate transaction.
 */
export const isAggregateTransactionDTO = transactionDTO => {
	const { transaction } = transactionDTO;

	return isAggregateTransaction(transaction);
};

const createMosaic = (id, amount) => mosaicFromDTO({ id, amount });

const mosaicFromDTO = mosaic => ({
	id: mosaic.id,
	amount: mosaic.amount
});

const formatAddress = (rawAddress, resolvedAddresses) => {
	if (rawAddress.length === 48)
		return addressFromRaw(rawAddress);

	return resolvedAddresses[rawAddress] || null;
};

/**
 * Converts a transaction DTO to a transaction object.
 * @param {object} transactionDTO - The transaction to convert.
 * @param {object} config - The configuration object.
 * @param {NetworkProperties} config.networkProperties - The network properties.
 * @param {PublicAccount} config.currentAccount - The current account.
 * @param {object.<string, string>} config.resolvedAddresses - The namespace id to account address map.
 * @param {object.<string, string>} config.namespaceNames - The namespace id to namespace name map.
 * @param {object.<string, Mosaic>} config.mosaicInfos - The mosaic id to info map.
 * @param {boolean} [config.isEmbedded] - A flag indicating if the transaction is embedded.
 * @returns {Transaction} The transaction object.
 */
export const transactionFromDTO = (transactionDTO, config) => {
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	switch (transactionDTO.transaction.type) {
	case TransactionType.AGGREGATE_BONDED:
	case TransactionType.AGGREGATE_COMPLETE:
		return aggregateTransactionFromDTO(transactionDTO, config);
	case TransactionType.TRANSFER:
		return transferTransactionFromDTO(transactionDTO, config);
	case TransactionType.ADDRESS_ALIAS:
		return addressAliasTransactionFromDTO(transactionDTO, config);
	case TransactionType.MOSAIC_ALIAS:
		return mosaicAliasTransactionFromDTO(transactionDTO, config);
	case TransactionType.NAMESPACE_REGISTRATION:
		return namespaceRegistrationTransactionFromDTO(transactionDTO, config);
	case TransactionType.MOSAIC_DEFINITION:
		return mosaicDefinitionTransactionFromDTO(transactionDTO, config);
	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		return mosaicSupplyChangeTransactionFromDTO(transactionDTO, config);
	case TransactionType.MOSAIC_SUPPLY_REVOCATION:
		return mosaicSupplyRevocationTransactionFromDTO(transactionDTO, config);
	case TransactionType.SECRET_LOCK:
		return secretLockTransactionFromDTO(transactionDTO, config);
	case TransactionType.HASH_LOCK:
		return hashLockTransactionFromDTO(transactionDTO, config);
	case TransactionType.SECRET_PROOF:
		return secretProofTransactionFromDTO(transactionDTO, config);
	case TransactionType.VRF_KEY_LINK:
		return vrfKeyLinkTransactionFromDTO(transactionDTO, config);
	case TransactionType.ACCOUNT_KEY_LINK:
		return accountKeyLinkTransactionFromDTO(transactionDTO, config);
	case TransactionType.NODE_KEY_LINK:
		return nodeKeyLinkTransactionFromDTO(transactionDTO, config);
	case TransactionType.VOTING_KEY_LINK:
		return votingKeyLinkTransactionFromDTO(transactionDTO, config);
	case TransactionType.MOSAIC_GLOBAL_RESTRICTION:
		return mosaicGlobalRestrictionTransactionFromDTO(transactionDTO, config);
	case TransactionType.MOSAIC_ADDRESS_RESTRICTION:
		return mosaicAddressRestrictionTransactionFromDTO(transactionDTO, config);
	case TransactionType.ACCOUNT_OPERATION_RESTRICTION:
		return accountOperationRestrictionTransactionFromDTO(transactionDTO, config);
	case TransactionType.ACCOUNT_ADDRESS_RESTRICTION:
		return accountAddressRestrictionTransactionFromDTO(transactionDTO, config);
	case TransactionType.ACCOUNT_MOSAIC_RESTRICTION:
		return accountMosaicRestrictionTransactionFromDTO(transactionDTO, config);
	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
		return multisigAccountModificationTransactionFromDTO(transactionDTO, config);
	case TransactionType.ACCOUNT_METADATA:
		return accountMetadataTransactionFromDTO(transactionDTO, config);
	case TransactionType.NAMESPACE_METADATA:
		return namespaceMetadataTransactionFromDTO(transactionDTO, config);
	case TransactionType.MOSAIC_METADATA:
		return mosaicMetadataTransactionFromDTO(transactionDTO, config);
	}

	return baseTransaction;
};

const baseTransactionFromDTO = (transactionDTO, config) => {
	const { networkProperties } = config;
	const { transaction, meta } = transactionDTO;
	const transactionNetworkIdentifier = networkTypeToIdentifier(transaction.network);

	if (transactionNetworkIdentifier !== networkProperties.networkIdentifier)
		throw new SdkError('Transaction network identifier does not match the current network identifier.');

	const { signerPublicKey, type } = transaction;
	const signerAddress = addressFromPublicKey(signerPublicKey, networkProperties.networkIdentifier);

	if (config.isEmbedded) {
		return {
			type,
			signerAddress,
			signerPublicKey
		};
	}

	return {
		type,
		deadline: {
			timestamp: networkTimestampToUnix(Number(transaction.deadline), networkProperties.epochAdjustment),
			adjusted: Number(transaction.deadline)
		},
		timestamp: networkTimestampToUnix(Number(meta.timestamp), networkProperties.epochAdjustment),
		height: Number(meta.height),
		hash: meta.hash,
		fee: transaction.maxFee
			? createFee(absoluteToRelativeAmount(transaction.maxFee, networkProperties.networkCurrency.divisibility), networkProperties)
			: null,
		signerAddress: signerPublicKey ? addressFromPublicKey(signerPublicKey, networkProperties.networkIdentifier) : null,
		signerPublicKey
	};
};

const aggregateTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const innerTransactions =
		transaction.transactions?.map(innerTransactionDTO => transactionFromDTO(innerTransactionDTO, { ...config, isEmbedded: true })) ||
		[];

	// Calculate the total transferred amount of all inner transactions
	const innerTransactionAmounts = innerTransactions.map(transaction => transaction.amount || 0n);
	const addAmounts = (...amounts) => amounts.reduce((accumulator, amount) => accumulator + amount, 0n);
	const totalAmount = safeOperationWithRelativeAmounts(
		config.networkProperties.networkCurrency.divisibility,
		innerTransactionAmounts,
		addAmounts
	);

	const cosignatures =
		transaction.cosignatures?.map(cosignature => ({
			signerPublicKey: cosignature.signerPublicKey,
			signature: cosignature.signature,
			version: Number(cosignature.version)
		})) || [];
	const info = {
		...baseTransaction,
		amount: totalAmount,
		innerTransactions,
		cosignatures,
		receivedCosignatures: cosignatures.map(cosignature =>
			addressFromPublicKey(cosignature.signerPublicKey, config.networkProperties.networkIdentifier))
	};

	return info;
};

const transferTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const { networkProperties, mosaicInfos, currentAccount, resolvedAddresses } = config;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const mosaics = transaction.mosaics?.map(mosaicFromDTO) || [];
	const formattedMosaics = formatMosaicList(mosaics, mosaicInfos);
	const nativeMosaicAmount = getMosaicAmount(formattedMosaics, networkProperties.networkCurrency.mosaicId);
	const transactionBody = {
		...baseTransaction,
		recipientAddress: formatAddress(transaction.recipientAddress, resolvedAddresses)
	};
	let resultAmount;

	const isIncoming = isIncomingTransaction(transactionBody, currentAccount);
	const isOutgoing = isOutgoingTransaction(transactionBody, currentAccount);

	if (nativeMosaicAmount === '0' || (!isIncoming && !isOutgoing) || (isIncoming && isOutgoing))
		resultAmount = '0';
	else if (isIncoming && !isOutgoing)
		resultAmount = `${nativeMosaicAmount}`;
	else if (!isIncoming && isOutgoing)
		resultAmount = `${-nativeMosaicAmount}`;

	if (transaction.message) {
		const messageBytes = Buffer.from(transaction.message, 'hex');
		const messageType = messageBytes[0];
		const messageText = messageType === MessageType.PlainText ? decodePlainMessage(transaction.message) : null;

		transactionBody.message = {
			type: messageType,
			text: messageText,
			payload: transaction.message
		};
	}

	return {
		...transactionBody,
		mosaics: formattedMosaics,
		amount: resultAmount
	};
};

const namespaceRegistrationTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const isRootNamespace = !transaction.parentId || transaction.parentId === '0000000000000000';
	const isUnlimitedDuration = !transaction.duration;

	return {
		...baseTransaction,
		registrationType: NamespaceRegistrationTypeMessage[transaction.registrationType],
		namespaceName: transaction.name,
		namespaceId: transaction.id,
		parentId: isRootNamespace ? null : transaction.parentId,
		duration: isUnlimitedDuration ? Message.UNLIMITED : Number(transaction.duration)
	};
};

const addressAliasTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	return {
		...baseTransaction,
		aliasAction: AliasActionMessage[transaction.aliasAction],
		namespaceId: transaction.namespaceId,
		namespaceName: config.namespaceNames[transaction.namespaceId],
		address: formatAddress(transaction.address, config.resolvedAddresses)
	};
};

const mosaicAliasTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	return {
		...baseTransaction,
		aliasAction: AliasActionMessage[transaction.aliasAction],
		namespaceId: transaction.namespaceId,
		namespaceName: config.namespaceNames[transaction.namespaceId],
		mosaicId: transaction.mosaicId
	};
};

const mosaicDefinitionTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	return {
		...baseTransaction,
		mosaicId: transaction.id,
		divisibility: transaction.divisibility,
		duration: Number(transaction.duration),
		nonce: transaction.nonce,
		isSupplyMutable: isSupplyMutableFlag(transaction.flags),
		isTransferable: isTransferableFlag(transaction.flags),
		isRestrictable: isRestrictableFlag(transaction.flags),
		isRevokable: isRevokableFlag(transaction.flags)
	};
};

const mosaicSupplyChangeTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	return {
		...baseTransaction,
		mosaicId: transaction.mosaicId,
		action: MosaicSupplyChangeActionMessage[transaction.action],
		delta: Number(transaction.delta)
	};
};

const mosaicSupplyRevocationTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const mosaic = createMosaic(transaction.mosaicId, transaction.amount);
	const formattedMosaics = formatMosaicList([mosaic], config.mosaicInfos);
	const sourceAddress = formatAddress(transaction.sourceAddress, config.resolvedAddresses);

	return {
		...baseTransaction,
		mosaicId: mosaic.id,
		mosaic: formattedMosaics[0],
		sourceAddress
	};
};

const multisigAccountModificationTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const addressAdditions = transaction.addressAdditions.map(address => formatAddress(address, config.resolvedAddresses));
	const addressDeletions = transaction.addressDeletions.map(address => formatAddress(address, config.resolvedAddresses));

	return {
		...baseTransaction,
		minApprovalDelta: transaction.minApprovalDelta,
		minRemovalDelta: transaction.minRemovalDelta,
		addressAdditions: addressAdditions,
		addressDeletions: addressDeletions
	};
};

const hashLockTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const mosaic = createMosaic(transaction.mosaicId, transaction.amount);
	const [formattedMosaic] = formatMosaicList([mosaic], config.mosaicInfos);

	return {
		...baseTransaction,
		duration: Number(transaction.duration),
		mosaic: formattedMosaic,
		lockedAmount: formattedMosaic.amount,
		aggregateHash: transaction.hash
	};
};

const secretLockTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const mosaic = createMosaic(transaction.mosaicId, transaction.amount);
	const formattedMosaics = formatMosaicList([mosaic], config.mosaicInfos);
	const resolvedAddress = formatAddress(transaction.recipientAddress, config.resolvedAddresses);

	return {
		...baseTransaction,
		duration: Number(transaction.duration),
		secret: transaction.secret,
		recipientAddress: resolvedAddress,
		hashAlgorithm: LockHashAlgorithmMessage[transaction.hashAlgorithm],
		mosaic: formattedMosaics[0]
	};
};

const secretProofTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const resolvedAddress = formatAddress(transaction.recipientAddress, config.resolvedAddresses);

	return {
		...baseTransaction,
		hashAlgorithm: LockHashAlgorithmMessage[transaction.hashAlgorithm],
		recipientAddress: resolvedAddress,
		secret: transaction.secret,
		proof: Buffer.from(transaction.proof).toString('hex').toUpperCase()
	};
};

const accountAddressRestrictionTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const addressAdditions = transaction.restrictionAdditions.map(address => formatAddress(address, config.resolvedAddresses));
	const addressDeletions = transaction.restrictionDeletions.map(address => formatAddress(address, config.resolvedAddresses));

	return {
		...baseTransaction,
		restrictionType: AddressRestrictionFlagMessage[transaction.restrictionFlags],
		restrictionAddressAdditions: addressAdditions,
		restrictionAddressDeletions: addressDeletions
	};
};

const accountMosaicRestrictionTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	return {
		...baseTransaction,
		restrictionType: MosaicRestrictionFlagMessage[transaction.restrictionFlags],
		restrictionMosaicAdditions: transaction.restrictionAdditions,
		restrictionMosaicDeletions: transaction.restrictionDeletions
	};
};

const accountOperationRestrictionTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

	return {
		...baseTransaction,
		restrictionType: OperationRestrictionFlagMessage[transaction.restrictionFlags],
		restrictionOperationAdditions: transaction.restrictionAdditions.map(operation => operation),
		restrictionOperationDeletions: transaction.restrictionDeletions.map(operation => operation)
	};
};

const mosaicAddressRestrictionTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const { mosaicId } = transaction;
	const mosaicName = config.mosaicInfos[mosaicId]?.name || null;
	const targetAddress = formatAddress(transaction.targetAddress, config.resolvedAddresses);

	return {
		...baseTransaction,
		restrictionKey: transaction.restrictionKey,
		newRestrictionValue: transaction.newRestrictionValue,
		previousRestrictionValue: transaction.previousRestrictionValue,
		mosaicId,
		mosaicName,
		targetAddress
	};
};

const mosaicGlobalRestrictionTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const referenceMosaicId = transaction.referenceMosaicId === '0000000000000000' ? transaction.mosaicId : transaction.referenceMosaicId;
	const mosaicName = config.mosaicInfos[referenceMosaicId]?.name || null;

	return {
		...baseTransaction,
		restrictionKey: transaction.restrictionKey,
		newRestrictionType: MosaicRestrictionTypeMessage[transaction.newRestrictionType],
		newRestrictionValue: transaction.newRestrictionValue,
		previousRestrictionType: MosaicRestrictionTypeMessage[transaction.previousRestrictionType],
		previousRestrictionValue: transaction.previousRestrictionValue,
		referenceMosaicId: referenceMosaicId,
		mosaicName
	};
};

const accountMetadataTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const targetAddress = formatAddress(transaction.targetAddress, config.resolvedAddresses);

	return {
		...baseTransaction,
		scopedMetadataKey: transaction.scopedMetadataKey,
		targetAddress,
		metadataValue: transaction.value,
		valueSizeDelta: transaction.valueSizeDelta
	};
};

const mosaicMetadataTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const mosaicId = transaction.targetMosaicId;
	const mosaicName = config.mosaicInfos[mosaicId]?.name || null;
	const targetAddress = formatAddress(transaction.targetAddress, config.resolvedAddresses);

	return {
		...baseTransaction,
		scopedMetadataKey: transaction.scopedMetadataKey,
		targetMosaicId: mosaicId,
		targetMosaicName: mosaicName,
		targetAddress,
		metadataValue: transaction.value,
		valueSizeDelta: transaction.valueSizeDelta
	};
};

const namespaceMetadataTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const targetAddress = formatAddress(transaction.targetAddress, config.resolvedAddresses);
	const { targetNamespaceId } = transaction;
	const namespaceName = config.namespaceNames[targetNamespaceId];

	return {
		...baseTransaction,
		scopedMetadataKey: transaction.scopedMetadataKey,
		metadataValue: transaction.value,
		valueSizeDelta: transaction.valueSizeDelta,
		targetNamespaceId: targetNamespaceId,
		namespaceName,
		targetAddress
	};
};

const votingKeyLinkTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const { linkedPublicKey } = transaction;
	const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

	return {
		...baseTransaction,
		linkAction: LinkActionMessage[transaction.linkAction],
		linkedPublicKey: linkedPublicKey,
		linkedAccountAddress,
		startEpoch: Number(transaction.startEpoch),
		endEpoch: Number(transaction.endEpoch)
	};
};

const vrfKeyLinkTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const { linkedPublicKey } = transaction;
	const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

	return {
		...baseTransaction,
		linkAction: LinkActionMessage[transaction.linkAction],
		linkedPublicKey,
		linkedAccountAddress
	};
};

const nodeKeyLinkTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const { linkedPublicKey } = transaction;
	const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

	return {
		...baseTransaction,
		linkAction: LinkActionMessage[transaction.linkAction],
		linkedPublicKey,
		linkedAccountAddress
	};
};

const accountKeyLinkTransactionFromDTO = (transactionDTO, config) => {
	const { transaction } = transactionDTO;
	const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
	const { linkedPublicKey } = transaction;
	const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

	return {
		...baseTransaction,
		linkAction: LinkActionMessage[transaction.linkAction],
		linkedPublicKey,
		linkedAccountAddress
	};
};

/**
 * Extracts unresolved namespace IDs, mosaic IDs, and addresses from a list of transaction DTOs returned by REST.
 *
 * For each transaction DTO, it inspects specific fields (depending on the transaction type)
 * that may contain unresolved references (namespace IDs instead of resolved addresses,
 * or mosaic/namespace ids that require name resolution).
 *
 * Returns a unique set of referenced mosaic and namespace IDs, and a list of unresolved addresses
 * identified by their namespace IDs with the transaction location at which they were observed.
 *
 * @param {Array<object>} transactionDTOs - Array of transaction DTOs (with 'transaction' and 'meta').
 * @returns {{ mosaicIds: string[], namespaceIds: string[], addresses: UnresolvedAddressWithLocation[] }}
 * The unresolved identifiers aggregated from the provided DTOs.
 * @see getUnresolvedIdsFromTransactions
 */
export const getUnresolvedIdsFromTransactionDTOs = transactionDTOs => {
	const fieldsMap = {
		[TransactionType.TRANSFER]: {
			address: ['recipientAddress'],
			mosaicArray: ['mosaics']
		},
		[TransactionType.ADDRESS_ALIAS]: {
			namespace: ['namespaceId']
		},
		[TransactionType.MOSAIC_ALIAS]: {
			namespace: ['namespaceId']
		},
		[TransactionType.MOSAIC_SUPPLY_REVOCATION]: {
			address: ['sourceAddress'],
			mosaic: ['mosaicId']
		},
		[TransactionType.MULTISIG_ACCOUNT_MODIFICATION]: {
			addressArray: ['addressAdditions', 'addressDeletions']
		},
		[TransactionType.HASH_LOCK]: {
			mosaic: ['mosaicId']
		},
		[TransactionType.SECRET_LOCK]: {
			address: ['recipientAddress'],
			mosaic: ['mosaicId']
		},
		[TransactionType.SECRET_PROOF]: {
			address: ['recipientAddress']
		},
		[TransactionType.ACCOUNT_ADDRESS_RESTRICTION]: {
			addressArray: ['restrictionAdditions', 'restrictionDeletions']
		},
		[TransactionType.MOSAIC_ADDRESS_RESTRICTION]: {
			address: ['targetAddress'],
			mosaic: ['mosaicId']
		},
		[TransactionType.MOSAIC_GLOBAL_RESTRICTION]: {
			mosaic: ['referenceMosaicId']
		},
		[TransactionType.ACCOUNT_METADATA]: {
			address: ['targetAddress']
		},
		[TransactionType.MOSAIC_METADATA]: {
			address: ['targetAddress'],
			mosaic: ['targetMosaicId']
		},
		[TransactionType.NAMESPACE_METADATA]: {
			address: ['targetAddress'],
			namespace: ['targetNamespaceId']
		}
	};

	const config = {
		fieldsMap,
		mapNamespaceId: id => id,
		mapMosaicId: id => id,
		mapTransactionType: type => type,
		getBodyFromTransaction: transaction => transaction.transaction,
		getTransactionLocation: transaction => {
			if (!transaction.meta.height || transaction.meta.height === '0')
				return undefined;

			return {
				height: transaction.meta.height,
				primaryId: transaction.meta.index + 1,
				secondaryId: 0
			};
		},
		verifyAddress: address => address.length === 48
	};

	return getUnresolvedIdsFromTransactions(transactionDTOs, config);
};
