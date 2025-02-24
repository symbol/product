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
    TransactionType,
} from '@/app/constants';
import { ChronoUnit, Instant } from '@js-joda/core';
import _ from 'lodash';
import { SymbolFacade, models } from 'symbol-sdk/symbol';
import * as NetworkTypes from '@/app/types/Network';
import * as TransactionTypes from '@/app/types/Transaction';
const { Transaction: SymbolTransaction } = models;

const createSymbolTransaction = (transactionDescriptor, networkProperties, isEmbedded, cousignatures) => {
    const facade = new SymbolFacade(networkProperties.networkIdentifier);

    if (isEmbedded) {
        return facade.transactionFactory.createEmbedded(_.omit(transactionDescriptor, 'fee', 'deadline'));
    }

    const transaction = facade.transactionFactory.create(transactionDescriptor);

    if (cousignatures?.length) transaction.cosignatures = cousignatures;

    return transaction;
};

const createSignerPublicKey = (transaction) =>
    transaction.signerPublicKey || '0000000000000000000000000000000000000000000000000000000000000000';

const createFee = (transaction, networkProperties) => {
    if (!transaction.fee) return 0n;

    const { divisibility } = networkProperties.networkCurrency;
    return BigInt(Math.round(Math.pow(10, divisibility) * transaction.fee));
};

const createMetadataKey = (key) => BigInt(`0x${key}`);

const createRestrictionKey = (key) => BigInt(`0x${key}`);

const createId = (id) => BigInt(`0x${id}`);

const createMosaic = (mosaic) => ({
    mosaicId: createId(mosaic.id),
    amount: BigInt(Math.pow(10, mosaic.divisibility) * mosaic.amount),
});

const createDeadline = (transaction, networkProperties, hours = 2) => {
    if (transaction.deadline) return BigInt(transaction.deadline - networkProperties.epochAdjustment * 1000);

    const deadlineDateTime = Instant.now().plus(hours, ChronoUnit.HOURS);
    const deadline = deadlineDateTime.minusSeconds(networkProperties.epochAdjustment).toEpochMilli();

    return BigInt(deadline);
};

/**
 * Converts a transaction to the symbol-sdk format.
 * @param {TransactionTypes.Transaction} transaction - The transaction to convert.
 * @param {object} config - The configuration object.
 * @param {NetworkTypes.NetworkProperties} config.networkProperties - The network properties
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

export const aggregateTransactionToSymbol = (transaction, config) => {
    const { networkProperties } = config;
    const facade = new SymbolFacade(networkProperties.networkIdentifier);
    const innerTransactions = transaction.innerTransactions.map((innerTransaction) =>
        transactionToSymbol(innerTransaction, { ...config, isEmbedded: true })
    );
    const merkleHash = facade.constructor.hashEmbeddedTransactions(innerTransactions);
    const cosignatures =
        transaction.cosignatures?.map((rawCosignature) => {
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
            signerPublicKey: createSignerPublicKey(transaction),
            fee: createFee(transaction, networkProperties),
            deadline: createDeadline(transaction, networkProperties, 48),
            transactionsHash: merkleHash,
            transactions: innerTransactions,
        };
    } else {
        descriptor = {
            type: 'aggregate_complete_transaction_v2',
            signerPublicKey: createSignerPublicKey(transaction),
            fee: createFee(transaction, networkProperties),
            deadline: createDeadline(transaction, networkProperties),
            transactionsHash: merkleHash,
            transactions: innerTransactions,
        };
    }

    return createSymbolTransaction(descriptor, networkProperties, false, cosignatures);
};

export const transferTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'transfer_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        recipientAddress: transaction.recipientAddress,
        mosaics: transaction.mosaics.map((mosaic) => createMosaic(mosaic)),
    };

    if (transaction.message?.payload) {
        descriptor.message = Buffer.from(transaction.message.payload, 'hex');
    }

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const namespaceRegistrationTransactionToSymbol = (transaction, config) => {
    let descriptor;
    const { networkProperties, isEmbedded } = config;

    if (transaction.registrationType === NamespaceRegistrationTypeMessage[NamespaceRegistrationType.RootNamespace]) {
        descriptor = {
            type: 'namespace_registration_transaction_v1',
            signerPublicKey: createSignerPublicKey(transaction),
            deadline: createDeadline(transaction, networkProperties),
            fee: createFee(transaction, networkProperties),
            parentId: 0n,
            duration: transaction.duration === Message.UNLIMITED ? 0n : BigInt(transaction.duration),
            name: transaction.namespaceName,
            registrationType: 'root',
        };
    } else {
        descriptor = {
            type: 'namespace_registration_transaction_v1',
            signerPublicKey: createSignerPublicKey(transaction),
            deadline: createDeadline(transaction, networkProperties),
            fee: createFee(transaction, networkProperties),
            parentId: createId(transaction.parentId),
            name: transaction.namespaceName,
            registrationType: 'child',
        };
    }

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const addressAliasTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'address_alias_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        namespaceId: createId(transaction.namespaceId),
        address: transaction.address,
        aliasAction: transaction.aliasAction === AliasActionMessage[AliasAction.Link] ? 'link' : 'unlink',
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const mosaicAliasTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'mosaic_alias_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        namespaceId: createId(transaction.namespaceId),
        mosaicId: createId(transaction.mosaicId),
        aliasAction: AliasActionMessage[AliasAction.Link] === transaction.aliasAction ? AliasAction.Link : AliasAction.Unlink,
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const mosaicDefinitionTransactionToSymbol = (transaction, config) => {
    const flags = [];
    if (transaction.isTransferable) flags.push('transferable');
    if (transaction.isSupplyMutable) flags.push('supply_mutable');
    if (transaction.isRestrictable) flags.push('restrictable');
    if (transaction.isRevokable) flags.push('revokable');

    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'mosaic_definition_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        duration: BigInt(transaction.duration),
        flags: flags.join(' '),
        nonce: transaction.nonce,
        divisibility: transaction.divisibility,
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const mosaicSupplyChangeTransactionToSymbol = (transaction, config) => {
    const action =
        MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.Increase] === transaction.action
            ? MosaicSupplyChangeAction.Increase
            : MosaicSupplyChangeAction.Decrease;

    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'mosaic_supply_change_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        delta: BigInt(transaction.delta),
        action,
        mosaicId: createId(transaction.mosaicId),
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const mosaicSupplyRevocationTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'mosaic_supply_revocation_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        mosaic: createMosaic(transaction.mosaic),
        sourceAddress: transaction.sourceAddress,
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const hashLockTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'hash_lock_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        mosaic: createMosaic({
            id: networkProperties.networkCurrency.mosaicId,
            divisibility: networkProperties.networkCurrency.divisibility,
            amount: Math.abs(transaction.lockedAmount),
        }),
        duration: BigInt(transaction.duration),
        hash: Buffer.from(transaction.aggregateHash, 'hex'),
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const secretLockTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'secret_lock_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        mosaic: createMosaic(transaction.mosaic),
        duration: BigInt(transaction.duration),
        recipientAddress: transaction.recipientAddress,
        secret: transaction.secret,
        hashAlgorithm: transaction.hashAlgorithm.toLowerCase().replace(/ /g, '_'),
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const secretProofTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'secret_proof_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        recipientAddress: transaction.recipientAddress,
        secret: transaction.secret,
        hashAlgorithm: transaction.hashAlgorithm.toLowerCase().replace(/ /g, '_'),
        proof: Buffer.from(transaction.proof, 'hex'),
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const vrfKeyLinkTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'vrf_key_link_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        linkedPublicKey: transaction.linkedPublicKey,
        linkAction: transaction.linkAction === LinkActionMessage[LinkAction.Link] ? 'link' : 'unlink',
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const accountKeyLinkTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'account_key_link_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        linkedPublicKey: transaction.linkedPublicKey,
        linkAction: transaction.linkAction === LinkActionMessage[LinkAction.Link] ? 'link' : 'unlink',
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const nodeKeyLinkTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'node_key_link_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        linkedPublicKey: transaction.linkedPublicKey,
        linkAction: transaction.linkAction === LinkActionMessage[LinkAction.Link] ? 'link' : 'unlink',
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const votingKeyLinkTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'voting_key_link_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        linkedPublicKey: transaction.linkedPublicKey,
        linkAction: transaction.linkAction === LinkActionMessage[LinkAction.Link] ? 'link' : 'unlink',
        startEpoch: transaction.startEpoch,
        endEpoch: transaction.endEpoch,
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const mosaicGlobalRestrictionTransactionToSymbol = (transaction, config) => {
    const restrictionTypeMap = {
        [MosaicRestrictionTypeMessage[MosaicRestrictionType.EQ]]: MosaicRestrictionType.EQ,
        [MosaicRestrictionTypeMessage[MosaicRestrictionType.GE]]: MosaicRestrictionType.GE,
        [MosaicRestrictionTypeMessage[MosaicRestrictionType.GT]]: MosaicRestrictionType.GT,
        [MosaicRestrictionTypeMessage[MosaicRestrictionType.LE]]: MosaicRestrictionType.LE,
        [MosaicRestrictionTypeMessage[MosaicRestrictionType.LT]]: MosaicRestrictionType.LT,
        [MosaicRestrictionTypeMessage[MosaicRestrictionType.NE]]: MosaicRestrictionType.NE,
        [MosaicRestrictionTypeMessage[MosaicRestrictionType.NONE]]: MosaicRestrictionType.NONE,
    };

    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'mosaic_global_restriction_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        mosaicId: createId(transaction.referenceMosaicId),
        referenceMosaicId: 0n,
        restrictionKey: createRestrictionKey(transaction.restrictionKey),
        previousRestrictionValue: BigInt(transaction.previousRestrictionValue),
        newRestrictionValue: BigInt(transaction.newRestrictionValue),
        previousRestrictionType: restrictionTypeMap[transaction.previousRestrictionType],
        newRestrictionType: restrictionTypeMap[transaction.newRestrictionType],
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const mosaicAddressRestrictionTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'mosaic_address_restriction_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        targetAddress: transaction.targetAddress,
        mosaicId: createId(transaction.mosaicId),
        restrictionKey: createRestrictionKey(transaction.restrictionKey),
        previousRestrictionValue: BigInt(transaction.previousRestrictionValue),
        newRestrictionValue: BigInt(transaction.newRestrictionValue),
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const accountOperationRestrictionTransactionToSymbol = (transaction, config) => {
    const restrictionFlagsMap = {
        [OperationRestrictionFlagMessage[OperationRestrictionFlag.AllowOutgoingTransactionType]]:
            OperationRestrictionFlag.AllowOutgoingTransactionType,
        [OperationRestrictionFlagMessage[OperationRestrictionFlag.BlockOutgoingTransactionType]]:
            OperationRestrictionFlag.BlockOutgoingTransactionType,
    };

    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'account_operation_restriction_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        restrictionFlags: restrictionFlagsMap[transaction.restrictionType],
        restrictionAdditions: transaction.restrictionOperationAdditions,
        restrictionDeletions: transaction.restrictionOperationDeletions,
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const accountAddressRestrictionTransactionToSymbol = (transaction, config) => {
    const restrictionFlagsMap = {
        [AddressRestrictionFlagMessage[AddressRestrictionFlag.AllowIncomingAddress]]: AddressRestrictionFlag.AllowIncomingAddress,
        [AddressRestrictionFlagMessage[AddressRestrictionFlag.AllowOutgoingAddress]]: AddressRestrictionFlag.AllowOutgoingAddress,
        [AddressRestrictionFlagMessage[AddressRestrictionFlag.BlockIncomingAddress]]: AddressRestrictionFlag.BlockIncomingAddress,
        [AddressRestrictionFlagMessage[AddressRestrictionFlag.BlockOutgoingAddress]]: AddressRestrictionFlag.BlockOutgoingAddress,
    };
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'account_address_restriction_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        restrictionFlags: restrictionFlagsMap[transaction.restrictionType],
        restrictionAdditions: transaction.restrictionAddressAdditions,
        restrictionDeletions: transaction.restrictionAddressDeletions,
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const accountMosaicRestrictionTransactionToSymbol = (transaction, config) => {
    const restrictionFlag =
        MosaicRestrictionFlagMessage[MosaicRestrictionFlag.AllowMosaic] === transaction.restrictionType ? 'allow' : 'block';

    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'account_mosaic_restriction_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        restrictionFlags: `${restrictionFlag} mosaic_id`,
        restrictionAdditions: transaction.restrictionMosaicAdditions.map(createId),
        restrictionDeletions: transaction.restrictionMosaicDeletions.map(createId),
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const multisigAccountModificationTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'multisig_account_modification_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        minApprovalDelta: transaction.minApprovalDelta,
        minRemovalDelta: transaction.minRemovalDelta,
        addressAdditions: transaction.addressAdditions,
        addressDeletions: transaction.addressDeletions,
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const accountMetadataTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'account_metadata_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        targetAddress: transaction.targetAddress,
        scopedMetadataKey: createMetadataKey(transaction.scopedMetadataKey),
        valueSizeDelta: transaction.valueSizeDelta,
        value: transaction.metadataValue, //Buffer.from(transaction.metadataValue, 'hex')
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const mosaicMetadataTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'mosaic_metadata_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        targetAddress: transaction.targetAddress,
        scopedMetadataKey: createMetadataKey(transaction.scopedMetadataKey),
        targetMosaicId: createId(transaction.targetMosaicId),
        valueSizeDelta: transaction.valueSizeDelta,
        value: transaction.metadataValue, //Buffer.from(transaction.metadataValue, 'hex')
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};

export const namespaceMetadataTransactionToSymbol = (transaction, config) => {
    const { networkProperties, isEmbedded } = config;
    const descriptor = {
        type: 'namespace_metadata_transaction_v1',
        signerPublicKey: createSignerPublicKey(transaction),
        fee: createFee(transaction, networkProperties),
        deadline: createDeadline(transaction, networkProperties),
        targetAddress: transaction.targetAddress,
        scopedMetadataKey: createMetadataKey(transaction.scopedMetadataKey),
        targetNamespaceId: createId(transaction.targetNamespaceId),
        valueSizeDelta: transaction.valueSizeDelta,
        value: transaction.metadataValue, //Buffer.from(transaction.metadataValue, 'hex')
    };

    return createSymbolTransaction(descriptor, networkProperties, isEmbedded);
};
