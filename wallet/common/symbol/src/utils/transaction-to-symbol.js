import {
	AddressRestrictionFlag,
	AddressRestrictionFlagMessage,
	AliasAction,
	AliasActionMessage,
	LinkAction,
	LinkActionMessage,
	Message,
	MosaicRestrictionFlag,
	MosaicRestrictionFlagMessage,
	MosaicRestrictionType,
	MosaicRestrictionTypeMessage,
	MosaicSupplyChangeAction,
	MosaicSupplyChangeActionMessage,
	NamespaceRegistrationType,
	NamespaceRegistrationTypeMessage,
	OperationRestrictionFlag,
	OperationRestrictionFlagMessage,
	TransactionType
} from '../constants';
import _ from 'lodash';
import { SymbolFacade, models } from 'symbol-sdk/symbol';
import { relativeToAbsoluteAmount } from 'wallet-common-core';
const { Transaction: SymbolTransaction } = models;

/** @typedef {import('../types/Transaction').Transaction} Transaction */

const createSymbolTransaction = (transactionDescriptor, networkIdentifier, isEmbedded, cousignatures) => {
	const facade = new SymbolFacade(networkIdentifier);

	if (isEmbedded) 
		return facade.transactionFactory.createEmbedded(_.omit(transactionDescriptor, 'fee', 'deadline'));
    
	const transaction = facade.transactionFactory.create(transactionDescriptor);

	if (cousignatures?.length) 
		transaction.cosignatures = cousignatures;

	return transaction;
};

const mapSignerPublicKey = signerPublicKey =>
	signerPublicKey || '0000000000000000000000000000000000000000000000000000000000000000';

const mapFee = fee => {
	if (!fee?.token.amount) 
		return 0n;

	return BigInt(relativeToAbsoluteAmount(fee.token.amount, fee.token.divisibility));
};

const mapDeadline = deadline => {
	if (!deadline?.adjusted)
		return 0n;

	return BigInt(deadline.adjusted);
};

const hexToBigint = hex => BigInt(`0x${hex}`);

const mapMetadataKey = key => hexToBigint(key);

const mapRestrictionKey = key => hexToBigint(key);

const mapId = id => hexToBigint(id);

const mapMosaic = mosaic => ({
	mosaicId: mapId(mosaic.id),
	amount: BigInt(relativeToAbsoluteAmount(mosaic.amount, mosaic.divisibility))
});

/**
 * Converts a transaction to the symbol-sdk format.
 * @param {Transaction} transaction - The transaction to convert.
 * @param {object} config - The configuration object.
 * @param {string} config.networkIdentifier - The network identifier.
 * @param {boolean} [config.isEmbedded] - A flag indicating if the transaction is embedded.
 * @returns {SymbolTransaction} The symbol-sdk format transaction.
 */
export const transactionToSymbol = (transaction, config) => {
	switch (transaction.type) {
	case TransactionType.AGGREGATE_BONDED:
	case TransactionType.AGGREGATE_COMPLETE:
		return aggregateTransactionToSymbol(transaction, config);
	case TransactionType.TRANSFER:
		return transferTransactionToSymbol(transaction, config);
	case TransactionType.ADDRESS_ALIAS:
		return addressAliasTransactionToSymbol(transaction, config);
	case TransactionType.MOSAIC_ALIAS:
		return mosaicAliasTransactionToSymbol(transaction, config);
	case TransactionType.NAMESPACE_REGISTRATION:
		return namespaceRegistrationTransactionToSymbol(transaction, config);
	case TransactionType.MOSAIC_DEFINITION:
		return mosaicDefinitionTransactionToSymbol(transaction, config);
	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		return mosaicSupplyChangeTransactionToSymbol(transaction, config);
	case TransactionType.MOSAIC_SUPPLY_REVOCATION:
		return mosaicSupplyRevocationTransactionToSymbol(transaction, config);
	case TransactionType.HASH_LOCK:
		return hashLockTransactionToSymbol(transaction, config);
	case TransactionType.SECRET_LOCK:
		return secretLockTransactionToSymbol(transaction, config);
	case TransactionType.SECRET_PROOF:
		return secretProofTransactionToSymbol(transaction, config);
	case TransactionType.VRF_KEY_LINK:
		return vrfKeyLinkTransactionToSymbol(transaction, config);
	case TransactionType.ACCOUNT_KEY_LINK:
		return accountKeyLinkTransactionToSymbol(transaction, config);
	case TransactionType.NODE_KEY_LINK:
		return nodeKeyLinkTransactionToSymbol(transaction, config);
	case TransactionType.VOTING_KEY_LINK:
		return votingKeyLinkTransactionToSymbol(transaction, config);
	case TransactionType.MOSAIC_GLOBAL_RESTRICTION:
		return mosaicGlobalRestrictionTransactionToSymbol(transaction, config);
	case TransactionType.MOSAIC_ADDRESS_RESTRICTION:
		return mosaicAddressRestrictionTransactionToSymbol(transaction, config);
	case TransactionType.ACCOUNT_OPERATION_RESTRICTION:
		return accountOperationRestrictionTransactionToSymbol(transaction, config);
	case TransactionType.ACCOUNT_ADDRESS_RESTRICTION:
		return accountAddressRestrictionTransactionToSymbol(transaction, config);
	case TransactionType.ACCOUNT_MOSAIC_RESTRICTION:
		return accountMosaicRestrictionTransactionToSymbol(transaction, config);
	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
		return multisigAccountModificationTransactionToSymbol(transaction, config);
	case TransactionType.ACCOUNT_METADATA:
		return accountMetadataTransactionToSymbol(transaction, config);
	case TransactionType.NAMESPACE_METADATA:
		return namespaceMetadataTransactionToSymbol(transaction, config);
	case TransactionType.MOSAIC_METADATA:
		return mosaicMetadataTransactionToSymbol(transaction, config);
	}

	return null;
};

const aggregateTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier } = config;
	const facade = new SymbolFacade(networkIdentifier);
	const innerTransactions = transaction.innerTransactions.map(innerTransaction =>
		transactionToSymbol(innerTransaction, { ...config, isEmbedded: true }));
	const merkleHash = facade.constructor.hashEmbeddedTransactions(innerTransactions);
	const cosignatures =
        transaction.cosignatures?.map(rawCosignature => {
        	const cosignature = new models.Cosignature();
        	cosignature.version = 0n;
        	cosignature.signerPublicKey = new models.PublicKey(rawCosignature.signerPublicKey);
        	cosignature.signature = new models.Signature(rawCosignature.signature);

        	return cosignature;
        }) || [];

	let descriptor;
	if (transaction.type === TransactionType.AGGREGATE_BONDED) {
		descriptor = {
			type: 'aggregate_bonded_transaction_v2',
			signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
			fee: mapFee(transaction.fee),
			deadline: mapDeadline(transaction.deadline),
			transactionsHash: merkleHash,
			transactions: innerTransactions
		};
	} else {
		descriptor = {
			type: 'aggregate_complete_transaction_v2',
			signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
			fee: mapFee(transaction.fee),
			deadline: mapDeadline(transaction.deadline),
			transactionsHash: merkleHash,
			transactions: innerTransactions
		};
	}

	return createSymbolTransaction(descriptor, networkIdentifier, false, cosignatures);
};

const transferTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'transfer_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		recipientAddress: transaction.recipientAddress,
		mosaics: transaction.mosaics.map(mosaic => mapMosaic(mosaic))
	};

	if (transaction.message?.payload) 
		descriptor.message = Buffer.from(transaction.message.payload, 'hex');
    
	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const namespaceRegistrationTransactionToSymbol = (transaction, config) => {
	let descriptor;
	const { networkIdentifier, isEmbedded } = config;

	if (transaction.registrationType === NamespaceRegistrationTypeMessage[NamespaceRegistrationType.RootNamespace]) {
		descriptor = {
			type: 'namespace_registration_transaction_v1',
			signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
			deadline: mapDeadline(transaction.deadline),
			fee: mapFee(transaction.fee),
			parentId: 0n,
			duration: transaction.duration === Message.UNLIMITED ? 0n : BigInt(transaction.duration),
			name: transaction.namespaceName,
			registrationType: 'root'
		};
	} else {
		descriptor = {
			type: 'namespace_registration_transaction_v1',
			signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
			deadline: mapDeadline(transaction.deadline),
			fee: mapFee(transaction.fee),
			parentId: mapId(transaction.parentId),
			name: transaction.namespaceName,
			registrationType: 'child'
		};
	}

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const addressAliasTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'address_alias_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		namespaceId: mapId(transaction.namespaceId),
		address: transaction.address,
		aliasAction: transaction.aliasAction === AliasActionMessage[AliasAction.Link] ? 'link' : 'unlink'
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const mosaicAliasTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'mosaic_alias_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		namespaceId: mapId(transaction.namespaceId),
		mosaicId: mapId(transaction.mosaicId),
		aliasAction: AliasActionMessage[AliasAction.Link] === transaction.aliasAction ? AliasAction.Link : AliasAction.Unlink
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const mosaicDefinitionTransactionToSymbol = (transaction, config) => {
	const flags = [];
	if (transaction.isTransferable) 
		flags.push('transferable');
	if (transaction.isSupplyMutable) 
		flags.push('supply_mutable');
	if (transaction.isRestrictable) 
		flags.push('restrictable');
	if (transaction.isRevokable) 
		flags.push('revokable');

	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'mosaic_definition_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		duration: BigInt(transaction.duration),
		flags: flags.join(' '),
		nonce: transaction.nonce,
		divisibility: transaction.divisibility
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const mosaicSupplyChangeTransactionToSymbol = (transaction, config) => {
	const action =
        MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.Increase] === transaction.action
        	? MosaicSupplyChangeAction.Increase
        	: MosaicSupplyChangeAction.Decrease;

	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'mosaic_supply_change_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		delta: BigInt(transaction.delta),
		action,
		mosaicId: mapId(transaction.mosaicId)
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const mosaicSupplyRevocationTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'mosaic_supply_revocation_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		mosaic: mapMosaic(transaction.mosaic),
		sourceAddress: transaction.sourceAddress
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const hashLockTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'hash_lock_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		mosaic: mapMosaic(transaction.mosaic),
		duration: BigInt(transaction.duration),
		hash: Buffer.from(transaction.aggregateHash, 'hex')
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const secretLockTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'secret_lock_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		mosaic: mapMosaic(transaction.mosaic),
		duration: BigInt(transaction.duration),
		recipientAddress: transaction.recipientAddress,
		secret: transaction.secret,
		hashAlgorithm: transaction.hashAlgorithm.toLowerCase().replace(/ /g, '_')
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const secretProofTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'secret_proof_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		recipientAddress: transaction.recipientAddress,
		secret: transaction.secret,
		hashAlgorithm: transaction.hashAlgorithm.toLowerCase().replace(/ /g, '_'),
		proof: Buffer.from(transaction.proof, 'hex')
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const vrfKeyLinkTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'vrf_key_link_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		linkedPublicKey: transaction.linkedPublicKey,
		linkAction: transaction.linkAction === LinkActionMessage[LinkAction.Link] ? 'link' : 'unlink'
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const accountKeyLinkTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'account_key_link_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		linkedPublicKey: transaction.linkedPublicKey,
		linkAction: transaction.linkAction === LinkActionMessage[LinkAction.Link] ? 'link' : 'unlink'
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const nodeKeyLinkTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'node_key_link_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		linkedPublicKey: transaction.linkedPublicKey,
		linkAction: transaction.linkAction === LinkActionMessage[LinkAction.Link] ? 'link' : 'unlink'
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const votingKeyLinkTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'voting_key_link_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		linkedPublicKey: transaction.linkedPublicKey,
		linkAction: transaction.linkAction === LinkActionMessage[LinkAction.Link] ? 'link' : 'unlink',
		startEpoch: transaction.startEpoch,
		endEpoch: transaction.endEpoch
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const mosaicGlobalRestrictionTransactionToSymbol = (transaction, config) => {
	const restrictionTypeMap = {
		[MosaicRestrictionTypeMessage[MosaicRestrictionType.EQ]]: MosaicRestrictionType.EQ,
		[MosaicRestrictionTypeMessage[MosaicRestrictionType.GE]]: MosaicRestrictionType.GE,
		[MosaicRestrictionTypeMessage[MosaicRestrictionType.GT]]: MosaicRestrictionType.GT,
		[MosaicRestrictionTypeMessage[MosaicRestrictionType.LE]]: MosaicRestrictionType.LE,
		[MosaicRestrictionTypeMessage[MosaicRestrictionType.LT]]: MosaicRestrictionType.LT,
		[MosaicRestrictionTypeMessage[MosaicRestrictionType.NE]]: MosaicRestrictionType.NE,
		[MosaicRestrictionTypeMessage[MosaicRestrictionType.NONE]]: MosaicRestrictionType.NONE
	};

	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'mosaic_global_restriction_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		mosaicId: mapId(transaction.referenceMosaicId),
		referenceMosaicId: 0n,
		restrictionKey: mapRestrictionKey(transaction.restrictionKey),
		previousRestrictionValue: BigInt(transaction.previousRestrictionValue),
		newRestrictionValue: BigInt(transaction.newRestrictionValue),
		previousRestrictionType: restrictionTypeMap[transaction.previousRestrictionType],
		newRestrictionType: restrictionTypeMap[transaction.newRestrictionType]
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const mosaicAddressRestrictionTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'mosaic_address_restriction_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		targetAddress: transaction.targetAddress,
		mosaicId: mapId(transaction.mosaicId),
		restrictionKey: mapRestrictionKey(transaction.restrictionKey),
		previousRestrictionValue: BigInt(transaction.previousRestrictionValue),
		newRestrictionValue: BigInt(transaction.newRestrictionValue)
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const accountOperationRestrictionTransactionToSymbol = (transaction, config) => {
	const restrictionFlagsMap = {
		[OperationRestrictionFlagMessage[OperationRestrictionFlag.AllowOutgoingTransactionType]]:
            OperationRestrictionFlag.AllowOutgoingTransactionType,
		[OperationRestrictionFlagMessage[OperationRestrictionFlag.BlockOutgoingTransactionType]]:
            OperationRestrictionFlag.BlockOutgoingTransactionType
	};

	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'account_operation_restriction_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		restrictionFlags: restrictionFlagsMap[transaction.restrictionType],
		restrictionAdditions: transaction.restrictionOperationAdditions,
		restrictionDeletions: transaction.restrictionOperationDeletions
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const accountAddressRestrictionTransactionToSymbol = (transaction, config) => {
	const restrictionFlagsMap = {
		[AddressRestrictionFlagMessage[AddressRestrictionFlag.AllowIncomingAddress]]: AddressRestrictionFlag.AllowIncomingAddress,
		[AddressRestrictionFlagMessage[AddressRestrictionFlag.AllowOutgoingAddress]]: AddressRestrictionFlag.AllowOutgoingAddress,
		[AddressRestrictionFlagMessage[AddressRestrictionFlag.BlockIncomingAddress]]: AddressRestrictionFlag.BlockIncomingAddress,
		[AddressRestrictionFlagMessage[AddressRestrictionFlag.BlockOutgoingAddress]]: AddressRestrictionFlag.BlockOutgoingAddress
	};
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'account_address_restriction_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		restrictionFlags: restrictionFlagsMap[transaction.restrictionType],
		restrictionAdditions: transaction.restrictionAddressAdditions,
		restrictionDeletions: transaction.restrictionAddressDeletions
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const accountMosaicRestrictionTransactionToSymbol = (transaction, config) => {
	const restrictionFlag =
        MosaicRestrictionFlagMessage[MosaicRestrictionFlag.AllowMosaic] === transaction.restrictionType ? 'allow' : 'block';

	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'account_mosaic_restriction_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		restrictionFlags: `${restrictionFlag} mosaic_id`,
		restrictionAdditions: transaction.restrictionMosaicAdditions.map(mapId),
		restrictionDeletions: transaction.restrictionMosaicDeletions.map(mapId)
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const multisigAccountModificationTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'multisig_account_modification_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		minApprovalDelta: transaction.minApprovalDelta,
		minRemovalDelta: transaction.minRemovalDelta,
		addressAdditions: transaction.addressAdditions,
		addressDeletions: transaction.addressDeletions
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const accountMetadataTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'account_metadata_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		targetAddress: transaction.targetAddress,
		scopedMetadataKey: mapMetadataKey(transaction.scopedMetadataKey),
		valueSizeDelta: transaction.valueSizeDelta,
		value: transaction.metadataValue //Buffer.from(transaction.metadataValue, 'hex')
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const mosaicMetadataTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'mosaic_metadata_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		targetAddress: transaction.targetAddress,
		scopedMetadataKey: mapMetadataKey(transaction.scopedMetadataKey),
		targetMosaicId: mapId(transaction.targetMosaicId),
		valueSizeDelta: transaction.valueSizeDelta,
		value: transaction.metadataValue //Buffer.from(transaction.metadataValue, 'hex')
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};

const namespaceMetadataTransactionToSymbol = (transaction, config) => {
	const { networkIdentifier, isEmbedded } = config;
	const descriptor = {
		type: 'namespace_metadata_transaction_v1',
		signerPublicKey: mapSignerPublicKey(transaction.signerPublicKey),
		fee: mapFee(transaction.fee),
		deadline: mapDeadline(transaction.deadline),
		targetAddress: transaction.targetAddress,
		scopedMetadataKey: mapMetadataKey(transaction.scopedMetadataKey),
		targetNamespaceId: mapId(transaction.targetNamespaceId),
		valueSizeDelta: transaction.valueSizeDelta,
		value: transaction.metadataValue //Buffer.from(transaction.metadataValue, 'hex')
	};

	return createSymbolTransaction(descriptor, networkIdentifier, isEmbedded);
};
