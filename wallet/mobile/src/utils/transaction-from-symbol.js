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
    TransactionType,
} from '@/app/constants';
import { addressFromPublicKey } from './account';
import {
    getMosaicRelativeAmount,
    getMosaicsWithRelativeAmounts,
    getNativeMosaicAmount,
    isRestrictableFlag,
    isRevokableFlag,
    isSupplyMutableFlag,
    isTransferableFlag,
} from './mosaic';
import { decodePlainMessage, getUnresolvedIdsFromTransactions, isIncomingTransaction, isOutgoingTransaction } from './transaction';
import { Address } from 'symbol-sdk/symbol';

const mapMosaic = (mosaic) => ({
    id: mosaic.mosaicId.toString().replace('0x', ''),
    amount: parseInt(mosaic.amount.toString()),
});

const mapAddress = (address) => new Address(address.bytes).toString();

const mapId = (id) => id.toString().replace('0x', '');

const mapMetadataValue = (array) => Buffer.from(array).toString();

const mapMetadataKey = (key) => key.toString(16).toUpperCase();

const mapRestrictionKey = (key) => ('0000000000000000' + key.toString(16).toUpperCase()).slice(-16);

export const transactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);

    switch (transaction.type.value) {
        case TransactionType.AGGREGATE_BONDED:
        case TransactionType.AGGREGATE_COMPLETE:
            return aggregateTransactionFromSymbol(transaction, config);
        case TransactionType.TRANSFER:
            return transferTransactionFromSymbol(transaction, config);
        case TransactionType.ADDRESS_ALIAS:
            return addressAliasTransactionFromSymbol(transaction, config);
        case TransactionType.MOSAIC_ALIAS:
            return mosaicAliasTransactionFromSymbol(transaction, config);
        case TransactionType.NAMESPACE_REGISTRATION:
            return namespaceRegistrationTransactionFromSymbol(transaction, config);
        case TransactionType.MOSAIC_DEFINITION:
            return mosaicDefinitionTransactionFromSymbol(transaction, config);
        case TransactionType.MOSAIC_SUPPLY_CHANGE:
            return mosaicSupplyChangeTransactionFromSymbol(transaction, config);
        case TransactionType.MOSAIC_SUPPLY_REVOCATION:
            return mosaicSupplyRevocationTransactionFromSymbol(transaction, config);
        case TransactionType.SECRET_LOCK:
            return secretLockTransactionFromSymbol(transaction, config);
        case TransactionType.HASH_LOCK:
            return hashLockTransactionFromSymbol(transaction, config);
        case TransactionType.SECRET_PROOF:
            return secretProofTransactionFromSymbol(transaction, config);
        case TransactionType.VRF_KEY_LINK:
            return vrfKeyLinkTransactionFromSymbol(transaction, config);
        case TransactionType.ACCOUNT_KEY_LINK:
            return accountKeyLinkTransactionFromSymbol(transaction, config);
        case TransactionType.NODE_KEY_LINK:
            return nodeKeyLinkTransactionFromSymbol(transaction, config);
        case TransactionType.VOTING_KEY_LINK:
            return votingKeyLinkTransactionFromSymbol(transaction, config);
        case TransactionType.MOSAIC_GLOBAL_RESTRICTION:
            return mosaicGlobalRestrictionTransactionFromSymbol(transaction, config);
        case TransactionType.MOSAIC_ADDRESS_RESTRICTION:
            return mosaicAddressRestrictionTransactionFromSymbol(transaction, config);
        case TransactionType.ACCOUNT_OPERATION_RESTRICTION:
            return accountOperationRestrictionTransactionFromSymbol(transaction, config);
        case TransactionType.ACCOUNT_ADDRESS_RESTRICTION:
            return accountAddressRestrictionTransactionFromSymbol(transaction, config);
        case TransactionType.ACCOUNT_MOSAIC_RESTRICTION:
            return accountMosaicRestrictionTransactionFromSymbol(transaction, config);
        case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
            return multisigAccountModificationTransactionFromSymbol(transaction, config);
        case TransactionType.ACCOUNT_METADATA:
            return accountMetadataTransactionFromSymbol(transaction, config);
        case TransactionType.NAMESPACE_METADATA:
            return namespaceMetadataTransactionFromSymbol(transaction, config);
        case TransactionType.MOSAIC_METADATA:
            return mosaicMetadataTransactionFromSymbol(transaction, config);
    }

    return baseTransaction;
};

export const baseTransactionFromSymbol = (transaction, config) => {
    const isSignerPublicKeyProvided =
        transaction.signerPublicKey?.toString() !== '0000000000000000000000000000000000000000000000000000000000000000';
    const signerPublicKey = isSignerPublicKeyProvided ? transaction.signerPublicKey.toString() : config.fillSignerPublickey;
    const signerAddress = signerPublicKey ? addressFromPublicKey(signerPublicKey, config.networkProperties.networkIdentifier) : null;
    const type = transaction.type.value;

    if (config.isEmbedded) {
        return {
            type,
            signerAddress,
            signerPublicKey,
        };
    }

    return {
        type,
        deadline: Number(transaction.deadline.value) + config.networkProperties.epochAdjustment * 1000,
        fee: transaction.fee
            ? getMosaicRelativeAmount(Number(transaction.fee.value), config.networkProperties.networkCurrency.divisibility)
            : null,
        signerAddress,
        signerPublicKey,
    };
};

export const aggregateTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const innerTransactions = transaction.transactions.map((innerTransaction) =>
        transactionFromSymbol(innerTransaction, { ...config, isEmbedded: true })
    );
    const resultAmount = innerTransactions.reduce((accumulator, transaction) => accumulator + (transaction.amount || 0), 0);

    const info = {
        ...baseTransaction,
        amount: resultAmount === -0 ? 0 : resultAmount,
        innerTransactions,
        cosignatures: transaction.cosignatures.map((cosignature) => ({
            signerPublicKey: cosignature.signerPublicKey.toString(),
            signature: cosignature.signature.toString(),
            version: Number(cosignature.version),
        })),
        receivedCosignatures: transaction.cosignatures.map((cosignature) =>
            addressFromPublicKey(cosignature.signerPublicKey.toString(), config.networkProperties.networkIdentifier)
        ),
    };

    return info;
};

export const transferTransactionFromSymbol = (transaction, config) => {
    const { networkProperties, mosaicInfos, currentAccount, resolvedAddresses } = config;
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const mosaics = transaction.mosaics.map(mapMosaic);
    const formattedMosaics = getMosaicsWithRelativeAmounts(mosaics, mosaicInfos);
    const nativeMosaicAmount = getNativeMosaicAmount(formattedMosaics, networkProperties.networkCurrency.mosaicId);
    const transactionBody = {
        ...baseTransaction,
        recipientAddress: mapAddress(transaction.recipientAddress, resolvedAddresses),
    };
    let resultAmount = 0;

    const isIncoming = isIncomingTransaction(transactionBody, currentAccount);
    const isOutgoing = isOutgoingTransaction(transactionBody, currentAccount);
    if (isIncoming && !isOutgoing) resultAmount = nativeMosaicAmount;
    else if (!isIncoming && isOutgoing) resultAmount = -nativeMosaicAmount;

    if (transaction.message?.length) {
        const messageType = transaction.message ? transaction.message[0] : null;
        const messagePayload = Buffer.from(transaction.message).toString('hex').toUpperCase();
        const messageText = messageType === MessageType.PlainText ? decodePlainMessage(messagePayload) : null;

        transactionBody.message = {
            type: messageType,
            text: messageText,
            payload: messagePayload,
        };
    }

    return {
        ...transactionBody,
        mosaics: formattedMosaics,
        amount: resultAmount === -0 ? 0 : resultAmount,
    };
};

export const namespaceRegistrationTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const parentId = !!transaction.parentId ? mapId(transaction.parentId) : '';

    return {
        ...baseTransaction,
        registrationType: NamespaceRegistrationTypeMessage[transaction.registrationType.value],
        namespaceName: Buffer.from(transaction.name).toString(),
        namespaceId: mapId(transaction.id),
        parentId: parentId !== '0000000000000000' ? parentId : null,
        duration: !!transaction.duration.value ? Number(transaction.duration.value) : Message.UNLIMITED,
    };
};

export const addressAliasTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const namespaceName = config.namespaceNames[mapId(transaction.namespaceId)];

    return {
        ...baseTransaction,
        aliasAction: AliasActionMessage[transaction.aliasAction.value],
        namespaceId: mapId(transaction.namespaceId),
        namespaceName,
        address: mapAddress(transaction.address),
    };
};

export const mosaicAliasTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const namespaceName = config.namespaceNames[mapId(transaction.namespaceId)];

    return {
        ...baseTransaction,
        aliasAction: AliasActionMessage[transaction.aliasAction.value],
        namespaceId: mapId(transaction.namespaceId),
        namespaceName,
        mosaicId: mapId(transaction.mosaicId),
    };
};

export const mosaicDefinitionTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);

    return {
        ...baseTransaction,
        mosaicId: mapId(transaction.id),
        divisibility: transaction.divisibility,
        duration: Number(transaction.duration),
        nonce: transaction.nonce.value,
        isSupplyMutable: isSupplyMutableFlag(transaction.flags.value),
        isTransferable: isTransferableFlag(transaction.flags.value),
        isRestrictable: isRestrictableFlag(transaction.flags.value),
        isRevokable: isRevokableFlag(transaction.flags.value),
    };
};

export const mosaicSupplyChangeTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);

    return {
        ...baseTransaction,
        mosaicId: mapId(transaction.mosaicId),
        action: MosaicSupplyChangeActionMessage[transaction.action.value],
        delta: Number(transaction.delta),
    };
};

export const mosaicSupplyRevocationTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const mosaic = mapMosaic(transaction.mosaic);
    const formattedMosaics = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const sourceAddress = mapAddress(transaction.sourceAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        mosaicId: mosaic.id,
        mosaic: formattedMosaics[0],
        sourceAddress,
    };
};

export const multisigAccountModificationTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const addressAdditions = transaction.addressAdditions.map((address) => mapAddress(address, config.resolvedAddresses));
    const addressDeletions = transaction.addressDeletions.map((address) => mapAddress(address, config.resolvedAddresses));

    return {
        ...baseTransaction,
        minApprovalDelta: transaction.minApprovalDelta,
        minRemovalDelta: transaction.minRemovalDelta,
        addressAdditions: addressAdditions,
        addressDeletions: addressDeletions,
    };
};

export const hashLockTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const mosaic = mapMosaic(transaction.mosaic);
    const [formattedMosaic] = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const lockedAmount = -formattedMosaic.amount;

    return {
        ...baseTransaction,
        duration: Number(transaction.duration),
        mosaic: formattedMosaic,
        lockedAmount: lockedAmount === -0 ? 0 : lockedAmount,
        aggregateHash: transaction.hash.toString('hex'),
    };
};

export const secretLockTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const mosaic = mapMosaic(transaction.mosaic);
    const formattedMosaics = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const resolvedAddress = mapAddress(transaction.recipientAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        duration: Number(transaction.duration),
        secret: transaction.secret.toString(),
        recipientAddress: resolvedAddress,
        hashAlgorithm: LockHashAlgorithmMessage[transaction.hashAlgorithm.value],
        mosaic: formattedMosaics[0],
    };
};

export const secretProofTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const resolvedAddress = mapAddress(transaction.recipientAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        hashAlgorithm: LockHashAlgorithmMessage[transaction.hashAlgorithm.value],
        recipientAddress: resolvedAddress,
        secret: transaction.secret.toString(),
        proof: Buffer.from(transaction.proof).toString('hex').toUpperCase(),
    };
};

export const accountAddressRestrictionTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const addressAdditions = transaction.restrictionAdditions.map((address) => mapAddress(address, config.resolvedAddresses));
    const addressDeletions = transaction.restrictionDeletions.map((address) => mapAddress(address, config.resolvedAddresses));

    return {
        ...baseTransaction,
        restrictionType: AddressRestrictionFlagMessage[transaction.restrictionFlags.value],
        restrictionAddressAdditions: addressAdditions,
        restrictionAddressDeletions: addressDeletions,
    };
};

export const accountMosaicRestrictionTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);

    return {
        ...baseTransaction,
        restrictionType: MosaicRestrictionFlagMessage[transaction.restrictionFlags.value],
        restrictionMosaicAdditions: transaction.restrictionAdditions.map(mapId),
        restrictionMosaicDeletions: transaction.restrictionDeletions.map(mapId),
    };
};

export const accountOperationRestrictionTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);

    return {
        ...baseTransaction,
        restrictionType: OperationRestrictionFlagMessage[transaction.restrictionFlags.value],
        restrictionOperationAdditions: transaction.restrictionAdditions.map((operation) => operation.value),
        restrictionOperationDeletions: transaction.restrictionDeletions.map((operation) => operation.value),
    };
};

export const mosaicAddressRestrictionTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const mosaicId = mapId(transaction.mosaicId);
    const mosaicName = config.mosaicInfos[mosaicId]?.name || null;
    const targetAddress = mapAddress(transaction.targetAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        restrictionKey: mapRestrictionKey(transaction.restrictionKey),
        newRestrictionValue: transaction.newRestrictionValue.toString(),
        previousRestrictionValue: transaction.previousRestrictionValue.toString(),
        mosaicId,
        mosaicName,
        targetAddress,
    };
};

export const mosaicGlobalRestrictionTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const referenceMosaicId =
        mapId(transaction.referenceMosaicId) === '0000000000000000' ? transaction.mosaicId : transaction.referenceMosaicId;
    const mosaicName = config.mosaicInfos[referenceMosaicId]?.name || null;

    return {
        ...baseTransaction,
        restrictionKey: mapRestrictionKey(transaction.restrictionKey),
        newRestrictionType: MosaicRestrictionTypeMessage[transaction.newRestrictionType.value],
        newRestrictionValue: transaction.newRestrictionValue.toString(),
        previousRestrictionType: MosaicRestrictionTypeMessage[transaction.previousRestrictionType.value],
        previousRestrictionValue: transaction.previousRestrictionValue.toString(),
        referenceMosaicId: mapId(referenceMosaicId),
        mosaicName,
    };
};

export const accountMetadataTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const targetAddress = mapAddress(transaction.targetAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        scopedMetadataKey: mapMetadataKey(transaction.scopedMetadataKey),
        targetAddress,
        metadataValue: mapMetadataValue(transaction.value),
        valueSizeDelta: transaction.valueSizeDelta,
    };
};

export const mosaicMetadataTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const mosaicId = mapId(transaction.targetMosaicId);
    const mosaicName = config.mosaicInfos[mosaicId]?.name || null;
    const targetAddress = mapAddress(transaction.targetAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        scopedMetadataKey: mapMetadataKey(transaction.scopedMetadataKey),
        targetMosaicId: mosaicId,
        targetMosaicName: mosaicName,
        targetAddress,
        metadataValue: mapMetadataValue(transaction.value),
        valueSizeDelta: transaction.valueSizeDelta,
    };
};

export const namespaceMetadataTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const targetAddress = mapAddress(transaction.targetAddress, config.resolvedAddresses);
    const targetNamespaceId = mapId(transaction.targetNamespaceId);
    const namespaceName = config.namespaceNames[targetNamespaceId];

    return {
        ...baseTransaction,
        scopedMetadataKey: mapMetadataKey(transaction.scopedMetadataKey),
        metadataValue: mapMetadataValue(transaction.value),
        valueSizeDelta: transaction.valueSizeDelta,
        targetNamespaceId: targetNamespaceId,
        namespaceName,
        targetAddress,
    };
};

export const votingKeyLinkTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const linkedPublicKey = transaction.linkedPublicKey.toString();
    const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: LinkActionMessage[transaction.linkAction.value],
        linkedPublicKey: linkedPublicKey,
        linkedAccountAddress,
        startEpoch: Number(transaction.startEpoch),
        endEpoch: Number(transaction.endEpoch),
    };
};

export const vrfKeyLinkTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const linkedPublicKey = transaction.linkedPublicKey.toString();
    const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: LinkActionMessage[transaction.linkAction.value],
        linkedPublicKey,
        linkedAccountAddress,
    };
};

export const nodeKeyLinkTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const linkedPublicKey = transaction.linkedPublicKey.toString();
    const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: LinkActionMessage[transaction.linkAction.value],
        linkedPublicKey,
        linkedAccountAddress,
    };
};

export const accountKeyLinkTransactionFromSymbol = (transaction, config) => {
    const baseTransaction = baseTransactionFromSymbol(transaction, config);
    const linkedPublicKey = transaction.linkedPublicKey.toString();
    const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: LinkActionMessage[transaction.linkAction.value],
        linkedPublicKey,
        linkedAccountAddress,
    };
};

export const getUnresolvedIdsFromSymbolTransactions = (transactions) => {
    const fieldsMap = {
        [TransactionType.TRANSFER]: {
            address: ['recipientAddress'],
            mosaicArray: ['mosaics'],
        },
        [TransactionType.ADDRESS_ALIAS]: {
            namespace: ['namespaceId'],
        },
        [TransactionType.MOSAIC_ALIAS]: {
            namespace: ['namespaceId'],
        },
        [TransactionType.MOSAIC_SUPPLY_REVOCATION]: {
            address: ['sourceAddress'],
            mosaic: ['mosaic'],
        },
        [TransactionType.MULTISIG_ACCOUNT_MODIFICATION]: {
            addressArray: ['addressAdditions', 'addressDeletions'],
        },
        [TransactionType.HASH_LOCK]: {
            mosaic: ['mosaic'],
        },
        [TransactionType.SECRET_LOCK]: {
            address: ['recipientAddress'],
            mosaic: ['mosaic'],
        },
        [TransactionType.SECRET_PROOF]: {
            address: ['recipientAddress'],
        },
        [TransactionType.ACCOUNT_ADDRESS_RESTRICTION]: {
            addressArray: ['restrictionAdditions', 'restrictionDeletions'],
        },
        [TransactionType.MOSAIC_ADDRESS_RESTRICTION]: {
            address: ['targetAddress'],
            mosaic: ['mosaicId'],
        },
        [TransactionType.MOSAIC_GLOBAL_RESTRICTION]: {
            mosaic: ['referenceMosaicId'],
        },
        [TransactionType.ACCOUNT_METADATA]: {
            address: ['targetAddress'],
        },
        [TransactionType.MOSAIC_METADATA]: {
            address: ['targetAddress'],
            mosaic: ['targetMosaicId'],
        },
        [TransactionType.NAMESPACE_METADATA]: {
            address: ['targetAddress'],
            namespace: ['targetNamespaceId'],
        },
    };

    const config = {
        fieldsMap,
        mapNamespaceId: (id) => mapId(id),
        mapMosaicId: (id) => mapId(id),
        mapTransactionType: (type) => type.value,
        getBodyFromTransaction: (transaction) => transaction,
        getHeightFromTransaction: (transaction) => transaction.height,
        verifyAddress: (address) => address.toString().length === 48,
    };

    return getUnresolvedIdsFromTransactions(transactions, config);
};
