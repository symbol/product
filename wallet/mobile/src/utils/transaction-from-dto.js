import { AddressRestrictionFlag, AddressRestrictionFlagMessage, AliasAction, AliasActionMessage, LinkAction, LinkActionMessage, LockHashAlgorithmMessage, Message, MosaicRestrictionFlag, MosaicRestrictionFlagMessage, MosaicRestrictionType, MosaicRestrictionTypeMessage, MosaicSupplyChangeAction, MosaicSupplyChangeActionMessage, NamespaceRegistrationType, NamespaceRegistrationTypeMessage, OperationRestrictionFlag, OperationRestrictionFlagMessage, TransactionType } from 'src/constants';
import _ from 'lodash';
import { SymbolFacade } from 'symbol-sdk-v3/symbol';
import { encryptMessage, getUnresolvedIdsFromTransactions, isAggregateTransaction } from './transaction';
import { transactionToSymbol } from 'src/utils/transaction-to-symbol';
import { networkTypeToIdentifier } from 'src/utils/network';
import { addressFromPublicKey, addressFromRaw, isSymbolAddress } from 'src/utils/account';
import { getMosaicRelativeAmount, getMosaicsWithRelativeAmounts, getNativeMosaicAmount, isRestrictableFlag, isRevokableFlag, isSupplyMutableFlag, isTransferableFlag } from './mosaic';
import { isIncomingTransaction, isOutgoingTransaction } from './transaction';

export const isAggregateTransactionDTO = (transactionDTO) => {
    const { transaction } = transactionDTO;

    return isAggregateTransaction(transaction);
};

const createMosaic = (id, amount) => mosaicFromDTO({ id, amount });

const mosaicFromDTO = (mosaic) => ({
    id: mosaic.id,
    amount: Number(mosaic.amount),
});

const addressFromDTO = (rawAddress, resolvedAddresses) => {
    if (rawAddress.length === 48)
        return addressFromRaw(rawAddress);

    return resolvedAddresses[rawAddress] || null;
};

/**
 * Converts a transaction to a Symbol transaction.
 * @param {object} transaction - The transaction to convert.
 * @param {object} config - The configuration object.
 * @param {object} config.networkProperties - The network properties.
 * @param {object} config.currentAccount - The current account.
 * @param {boolean} config.isEmbedded - A flag indicating if the transaction is embedded.
 * @returns {object} The Symbol transaction.
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

export const baseTransactionFromDTO = (transactionDTO, config) => {
    const { transaction, meta } = transactionDTO;
    const transactionNetworkIdentifier = networkTypeToIdentifier(transaction.network);

    if (transactionNetworkIdentifier !== config.networkProperties.networkIdentifier)
        throw new Error('Transaction network identifier does not match the current network identifier.');

    const { signerPublicKey, type } = transaction;
    const signerAddress = addressFromPublicKey(signerPublicKey, config.networkProperties.networkIdentifier);

    if (config.isEmbedded) {
        return {
            type,
            signerAddress,
            signerPublicKey,
        }
    }

    return {
        type,
        deadline: Number(transaction.deadline) + config.networkProperties.epochAdjustment * 1000,
        timestamp: Number(meta.timestamp) + config.networkProperties.epochAdjustment * 1000,
        height: Number(meta.height),
        hash: meta.hash,
        fee: transaction.maxFee
            ? getMosaicRelativeAmount(transaction.maxFee, config.networkProperties.networkCurrency.divisibility)
            : null,
        signerAddress: signerPublicKey
            ? addressFromPublicKey(signerPublicKey, config.networkProperties.networkIdentifier)
            : null,
        signerPublicKey,
    };
};

export const aggregateTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const innerTransactions = transaction.transactions?.map(
        (innerTransactionDTO) => transactionFromDTO(innerTransactionDTO, { ...config, isEmbedded: true })
    ) || [];
    const resultAmount = innerTransactions.reduce((accumulator, transaction) =>
        accumulator + (transaction.amount || 0), 0);

    const info = {
        ...baseTransaction,
        amount: resultAmount === -0 ? 0 : resultAmount,
        innerTransactions,
        cosignatures: transaction.cosignatures.map((cosignature) => ({
            signerPublicKey: cosignature.signerPublicKey,
            signature: cosignature.signature,
            version: Number(cosignature.version),
        })),
        receivedCosignatures: transaction.cosignatures.map((cosignature) =>
            addressFromPublicKey(cosignature.signerPublicKey, config.networkProperties.networkIdentifier)
        )
    };

    return info;
};

export const transferTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const { networkProperties, mosaicInfos, currentAccount, resolvedAddresses } = config;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const mosaics = transaction.mosaics.map(mosaicFromDTO);
    const formattedMosaics = getMosaicsWithRelativeAmounts(mosaics, mosaicInfos);
    const nativeMosaicAmount = getNativeMosaicAmount(formattedMosaics, networkProperties.networkCurrency.mosaicId);
    const transactionBody = {
        ...baseTransaction,
        recipientAddress: addressFromDTO(transaction.recipientAddress, resolvedAddresses),
    };
    let resultAmount = 0;

    const isIncoming = isIncomingTransaction(transactionBody, currentAccount);
    const isOutgoing = isOutgoingTransaction(transactionBody, currentAccount)
    if (isIncoming && !isOutgoing)
        resultAmount = nativeMosaicAmount;
    else if (!isIncoming && isOutgoing)
        resultAmount = -nativeMosaicAmount;

    if (transaction.message) {
        const messageBytes = Buffer.from(transaction.message, 'hex');
        const messageType = messageBytes[0];
        const isMessagePlain = messageType === 0;
        const isMessageEncrypted = messageType === 1;
        const isDelegatedHarvestingMessage = messageType === 254;
        const isMessageRaw = messageType === !isMessagePlain && !isMessageEncrypted && !isDelegatedHarvestingMessage;
        let messagePayload = null;

        switch (true) {
            case isMessagePlain:
                messagePayload = Buffer.from(messageBytes.subarray(1)).toString();
                break;
            case isMessageEncrypted:
                messagePayload = transaction.message;
                break;
            case isDelegatedHarvestingMessage:
            case isMessageRaw:
                messagePayload = transaction.message;
                break;
        }


        transactionBody.message = {
            encryptedText: isMessageEncrypted ? messagePayload : null,
            text: isMessagePlain ? messagePayload : null,
            payload: (isDelegatedHarvestingMessage || isMessageRaw) ? messagePayload : null,
            isRaw: isMessageRaw,
            isEncrypted: isMessageEncrypted,
            isDelegatedHarvestingMessage,
        };
    }

    return {
        ...transactionBody,
        mosaics: formattedMosaics,
        amount: resultAmount === -0 ? 0 : resultAmount,
    };
};

export const namespaceRegistrationTransactionFromDTO = (transactionDTO, config) => {
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
        duration: isUnlimitedDuration ? Message.UNLIMITED : Number(transaction.duration),
    };
};

export const addressAliasTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

    return {
        ...baseTransaction,
        aliasAction: AliasActionMessage[transaction.aliasAction],
        namespaceId: transaction.namespaceId,
        namespaceName: config.namespaceNames[transaction.namespaceId],
        address: addressFromDTO(transaction.address, config.resolvedAddresses),
    };
};

export const mosaicAliasTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

    return {
        ...baseTransaction,
        aliasAction: AliasActionMessage[transaction.aliasAction],
        namespaceId: (transaction.namespaceId),
        namespaceName: config.namespaceNames[transaction.namespaceId],
        mosaicId: transaction.mosaicId,
    };
};

export const mosaicDefinitionTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

    return {
        ...baseTransaction,
        mosaicId: (transaction.id),
        divisibility: transaction.divisibility,
        duration: Number(transaction.duration),
        nonce: transaction.nonce,
        isSupplyMutable: isSupplyMutableFlag(transaction.flags),
        isTransferable: isTransferableFlag(transaction.flags),
        isRestrictable: isRestrictableFlag(transaction.flags),
        isRevokable: isRevokableFlag(transaction.flags),
    };
};

export const mosaicSupplyChangeTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

    return {
        ...baseTransaction,
        mosaicId: (transaction.mosaicId),
        action: MosaicSupplyChangeActionMessage[transaction.action],
        delta: Number(transaction.delta),
    };
};

export const mosaicSupplyRevocationTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const mosaic = createMosaic(transaction.mosaicId, transaction.amount);
    const formattedMosaics = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const sourceAddress = addressFromDTO(transaction.sourceAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        mosaicId: mosaic.id,
        mosaic: formattedMosaics[0],
        sourceAddress,
    };
};

export const multisigAccountModificationTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const addressAdditions = transaction.addressAdditions.map((address) => addressFromDTO(address, config.resolvedAddresses));
    const addressDeletions = transaction.addressDeletions.map((address) => addressFromDTO(address, config.resolvedAddresses));

    return {
        ...baseTransaction,
        minApprovalDelta: transaction.minApprovalDelta,
        minRemovalDelta: transaction.minRemovalDelta,
        addressAdditions: addressAdditions,
        addressDeletions: addressDeletions,
    };
};

export const hashLockTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const mosaic = createMosaic(transaction.mosaicId, transaction.amount);
    const [formattedMosaic] = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const lockedAmount = -formattedMosaic.amount;

    return {
        ...baseTransaction,
        duration: Number(transaction.duration),
        mosaic: formattedMosaic,
        lockedAmount: lockedAmount === -0 ? 0 : lockedAmount,
        aggregateHash: transaction.hash
    };
};

export const secretLockTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const mosaic = createMosaic(transaction.mosaicId, transaction.amount);
    const formattedMosaics = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const resolvedAddress = addressFromDTO(transaction.recipientAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        duration: Number(transaction.duration),
        secret: transaction.secret,
        recipientAddress: resolvedAddress,
        hashAlgorithm: LockHashAlgorithmMessage[transaction.hashAlgorithm],
        mosaic: formattedMosaics[0],
    };
};

export const secretProofTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const resolvedAddress = addressFromDTO(transaction.recipientAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        hashAlgorithm: LockHashAlgorithmMessage[transaction.hashAlgorithm],
        recipientAddress: resolvedAddress,
        secret: transaction.secret,
        proof: Buffer.from(transaction.proof).toString('hex').toUpperCase(),
    };
};

export const accountAddressRestrictionTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const addressAdditions = transaction.restrictionAdditions.map((address) => addressFromDTO(address, config.resolvedAddresses));
    const addressDeletions = transaction.restrictionDeletions.map((address) => addressFromDTO(address, config.resolvedAddresses));

    return {
        ...baseTransaction,
        restrictionType: AddressRestrictionFlagMessage[transaction.restrictionFlags],
        restrictionAddressAdditions: addressAdditions,
        restrictionAddressDeletions: addressDeletions,
    };
};

export const accountMosaicRestrictionTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

    return {
        ...baseTransaction,
        restrictionType: MosaicRestrictionFlagMessage[transaction.restrictionFlags],
        restrictionMosaicAdditions: transaction.restrictionAdditions,
        restrictionMosaicDeletions: transaction.restrictionDeletions,
    };
};

export const accountOperationRestrictionTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);

    return {
        ...baseTransaction,
        restrictionType: OperationRestrictionFlagMessage[transaction.restrictionFlags],
        restrictionOperationAdditions: transaction.restrictionAdditions.map((operation) => operation),
        restrictionOperationDeletions: transaction.restrictionDeletions.map((operation) => operation),
    };
};

export const mosaicAddressRestrictionTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const mosaicId = (transaction.mosaicId);
    const mosaicName = config.mosaicInfos[mosaicId]?.name || null;
    const targetAddress = addressFromDTO(transaction.targetAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        restrictionKey: transaction.restrictionKey,
        newRestrictionValue: transaction.newRestrictionValue,
        previousRestrictionValue: transaction.previousRestrictionValue,
        mosaicId,
        mosaicName,
        targetAddress,
    };
};

export const mosaicGlobalRestrictionTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const referenceMosaicId =
        (transaction.referenceMosaicId) === '0000000000000000' ? transaction.mosaicId : transaction.referenceMosaicId;
    const mosaicName = config.mosaicInfos[referenceMosaicId]?.name || null;

    return {
        ...baseTransaction,
        restrictionKey: transaction.restrictionKey,
        newRestrictionType: MosaicRestrictionTypeMessage[transaction.newRestrictionType],
        newRestrictionValue: transaction.newRestrictionValue,
        previousRestrictionType: MosaicRestrictionTypeMessage[transaction.previousRestrictionType],
        previousRestrictionValue: transaction.previousRestrictionValue,
        referenceMosaicId: (referenceMosaicId),
        mosaicName,
    };
};

export const accountMetadataTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const targetAddress = addressFromDTO(transaction.targetAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        scopedMetadataKey: transaction.scopedMetadataKey,
        targetAddress,
        metadataValue: transaction.value,
        valueSizeDelta: transaction.valueSizeDelta,
    };
};

export const mosaicMetadataTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const mosaicId = (transaction.targetMosaicId);
    const mosaicName = config.mosaicInfos[mosaicId]?.name || null;
    const targetAddress = addressFromDTO(transaction.targetAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        scopedMetadataKey: transaction.scopedMetadataKey,
        targetMosaicId: mosaicId,
        targetMosaicName: mosaicName,
        targetAddress,
        metadataValue: transaction.value,
        valueSizeDelta: transaction.valueSizeDelta,
    };
};

export const namespaceMetadataTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const targetAddress = addressFromDTO(transaction.targetAddress, config.resolvedAddresses);
    const targetNamespaceId = (transaction.targetNamespaceId);
    const namespaceName = config.namespaceNames[targetNamespaceId];

    return {
        ...baseTransaction,
        scopedMetadataKey: transaction.scopedMetadataKey,
        metadataValue: transaction.value,
        valueSizeDelta: transaction.valueSizeDelta,
        targetNamespaceId: targetNamespaceId,
        namespaceName,
        targetAddress,
    };
};

export const votingKeyLinkTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const linkedPublicKey = transaction.linkedPublicKey;
    const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: LinkActionMessage[transaction.linkAction],
        linkedPublicKey: linkedPublicKey,
        linkedAccountAddress,
        startEpoch: Number(transaction.startEpoch),
        endEpoch: Number(transaction.endEpoch),
    };
};

export const vrfKeyLinkTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const linkedPublicKey = transaction.linkedPublicKey;
    const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: LinkActionMessage[transaction.linkAction],
        linkedPublicKey,
        linkedAccountAddress,
    };
};

export const nodeKeyLinkTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const linkedPublicKey = transaction.linkedPublicKey;
    const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: LinkActionMessage[transaction.linkAction],
        linkedPublicKey,
        linkedAccountAddress,
    };
};

export const accountKeyLinkTransactionFromDTO = (transactionDTO, config) => {
    const { transaction } = transactionDTO;
    const baseTransaction = baseTransactionFromDTO(transactionDTO, config);
    const linkedPublicKey = transaction.linkedPublicKey;
    const linkedAccountAddress = addressFromPublicKey(linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: LinkActionMessage[transaction.linkAction],
        linkedPublicKey,
        linkedAccountAddress,
    };
};

export const getUnresolvedIdsFromTransactionDTOs = (transactionDTOs) => {
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
            mosaic: ['mosaicId'],
        },
        [TransactionType.MULTISIG_ACCOUNT_MODIFICATION]: {
            addressArray: ['addressAdditions', 'addressDeletions'],
        },
        [TransactionType.HASH_LOCK]: {
            mosaic: ['mosaicId'],
        },
        [TransactionType.SECRET_LOCK]: {
            address: ['recipientAddress'],
            mosaic: ['mosaicId'],
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
        mapNamespaceId: id => id,
        mapMosaicId: id => id,
        mapTransactionType: type => type,
        getBodyFromTransaction: transaction => transaction.transaction,
        getHeightFromTransaction: transaction => transaction.meta.height,
        verifyAddress: address => address.length === 48,
    };

    return getUnresolvedIdsFromTransactions(transactionDTOs, config);
};