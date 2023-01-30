import { Constants } from 'src/config';
import { Address, TransactionType } from 'symbol-sdk';
import { formatDeadline, getNativeMosaicAmount, getMosaicRelativeAmount, getMosaicsWithRelativeAmounts, isIncomingTransaction, isOutgoingTransaction, addressFromPublicKey } from './';

export const mosaicFromDTO = mosaic => ({
    id: mosaic.id.toHex(),
    amount: parseInt(mosaic.amount.toString())
});

export const addressFromDTO = (address, resolvedAddresses) => address.isNamespaceId()
    ? resolvedAddresses[address.toHex()]
    : address.plain();

export const transactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);

    switch (transaction.type) {
        case TransactionType.AGGREGATE_BONDED:
        case TransactionType.AGGREGATE_COMPLETE:
            return aggregateTransactionFromDTO(transaction, config);
        case TransactionType.TRANSFER:
            return transferTransactionFromDTO(transaction, config);
        case TransactionType.ADDRESS_ALIAS:
            return addressAliasTransactionFromDTO(transaction, config);
        case TransactionType.MOSAIC_ALIAS:
            return mosaicAliasTransactionFromDTO(transaction, config);
        case TransactionType.NAMESPACE_REGISTRATION:
            return namespaceRegistrationTransactionFromDTO(transaction, config);
        case TransactionType.MOSAIC_DEFINITION:
            return mosaicDefinitionTransactionFromDTO(transaction, config);
        case TransactionType.MOSAIC_SUPPLY_CHANGE:
            return mosaicSupplyChangeTransactionFromDTO(transaction, config);
        case TransactionType.MOSAIC_SUPPLY_REVOCATION:
            return mosaicSupplyRevocationTransactionFromDTO(transaction, config);
        case TransactionType.SECRET_LOCK:
            return secretLockTransactionFromDTO(transaction, config);
        case TransactionType.HASH_LOCK:
            return hashLockTransactionFromDTO(transaction, config);
        case TransactionType.SECRET_PROOF:
            return secretProofTransactionFromDTO(transaction, config);
        case TransactionType.VRF_KEY_LINK:
            return vrfKeyLinkTransactionFromDTO(transaction, config);
        case TransactionType.ACCOUNT_KEY_LINK:
            return accountKeyLinkTransactionFromDTO(transaction, config);
        case TransactionType.NODE_KEY_LINK:
            return nodeKeyLinkTransactionFromDTO(transaction, config);
        case TransactionType.VOTING_KEY_LINK:
            return votingKeyLinkTransactionFromDTO(transaction, config);
        case TransactionType.MOSAIC_GLOBAL_RESTRICTION:
            return mosaicGlobalRestrictionTransactionFromDTO(transaction, config);
        case TransactionType.MOSAIC_ADDRESS_RESTRICTION:
            return mosaicAddressRestrictionTransactionFromDTO(transaction, config);
        case TransactionType.ACCOUNT_OPERATION_RESTRICTION:
            return accountOperationRestrictionTransactionFromDTO(transaction, config);
        case TransactionType.ACCOUNT_ADDRESS_RESTRICTION:
            return accountAddressRestrictionTransactionFromDTO(transaction, config);
        case TransactionType.ACCOUNT_MOSAIC_RESTRICTION:
            return accountMosaicRestrictionTransactionFromDTO(transaction, config);
        case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
            return multisigAccountModificationTransactionFromDTO(transaction, config);
        case TransactionType.ACCOUNT_METADATA:
            return accountMetadataTransactionFromDTO(transaction, config);
        case TransactionType.NAMESPACE_METADATA:
            return namespaceMetadataTransactionFromDTO(transaction, config);
        case TransactionType.MOSAIC_METADATA:
            return mosaicMetadataTransactionFromDTO(transaction, config);
    }

    return baseTransaction;
}

export const baseTransactionFromDTO = (transaction, {networkProperties}) => {
    return baseTransaction = {
        type: transaction.type,
        deadline: formatDeadline(transaction.deadline.toLocalDateTime(networkProperties.epochAdjustment)),
        height: transaction.transactionInfo?.height.toString(),
        hash: transaction.transactionInfo?.hash,
        id: transaction.transactionInfo?.id,
        fee: getMosaicRelativeAmount(transaction.maxFee.toString(), networkProperties.networkCurrency.divisibility),
        signerAddress: transaction.signer?.address.plain(),
    };
};

export const aggregateTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const innerTransactions = transaction.innerTransactions.map(innerTransaction => transactionFromDTO(innerTransaction, config));
    const cosignaturePublicKeys = transaction.cosignatures.map(cosignature => cosignature.signer.publicKey);
    const resultAmount = innerTransactions.reduce((accumulator, transaction) => accumulator + (transaction.amount || 0), 0);

    if (transaction.signer) {
        cosignaturePublicKeys.push(transaction.signer.publicKey);
    }

    const info = {
        ...baseTransaction,
        cosignaturePublicKeys: cosignaturePublicKeys,
        amount: resultAmount,
        innerTransactions
    };

    if (transaction.type === TransactionType.AGGREGATE_BONDED) {
        info.receivedCosignatures = transaction.cosignatures.map(signature => signature.signer.address.plain());
        info.signTransactionObject = transaction;
    }

    return info;
};

export const transferTransactionFromDTO = (transaction, {networkProperties, mosaicInfos, currentAccount, resolvedAddresses}) => {
    const baseTransaction = baseTransactionFromDTO(transaction, {networkProperties});
    const mosaics = transaction.mosaics.map(mosaicFromDTO);
    const formattedMosaics = getMosaicsWithRelativeAmounts(mosaics, mosaicInfos);
    const nativeMosaicAmount = getNativeMosaicAmount(formattedMosaics, networkProperties.networkCurrency.mosaicId);
    const transactionBody = {
        ...baseTransaction,
        signerPublicKey: transaction.signer?.publicKey,
        recipientAddress: addressFromDTO(transaction.recipientAddress, resolvedAddresses),
    };
    let resultAmount = 0;

    if (isIncomingTransaction(transactionBody, currentAccount) && !isOutgoingTransaction(transactionBody, currentAccount)) {
        resultAmount = nativeMosaicAmount;
    }
    else if (!isIncomingTransaction(transactionBody, currentAccount) && isOutgoingTransaction(transactionBody, currentAccount)) {
        resultAmount = -nativeMosaicAmount;
    }

    const isMessageEncrypted = transaction.message.type === 0x01;
    const messagePayload = transaction.message.payload;
    let message = null;

    if (messagePayload && !isMessageEncrypted) {
        message = {
            text: messagePayload,
            isEncrypted: isMessageEncrypted,
        }
    }
    else if (messagePayload && isMessageEncrypted) {
        message = {
            encryptedText: messagePayload,
            isEncrypted: isMessageEncrypted,
        }
    }

    return {
        ...transactionBody,
        message,
        mosaics: formattedMosaics,
        amount: resultAmount
    };
};

export const namespaceRegistrationTransactionFromDTO = (transaction, {networkProperties}) => {
    const baseTransaction = baseTransactionFromDTO(transaction, {networkProperties});

    return {
        ...baseTransaction,
        registrationType: Constants.NamespaceRegistrationType[transaction.registrationType],
        namespaceName: transaction.namespaceName,
        namespaceId: transaction.namespaceId.toHex(),
        parentId: typeof transaction.parentId !== 'undefined' ? transaction.parentId?.toHex() : '',
        duration: typeof transaction.duration !== 'undefined' ? transaction.duration?.compact() : Constants.Message.UNLIMITED,
    };
};

export const addressAliasTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const namespaceName = config.namespaceNames[transaction.namespaceId.toHex()];

    return {
        ...baseTransaction,
        aliasAction: Constants.AliasAction[transaction.aliasAction],
        namespaceId: transaction.namespaceId.toHex(),
        namespaceName,
        address: transaction.address.plain(),
    };
};

export const mosaicAliasTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const namespaceName = config.namespaceNames[transaction.namespaceId.toHex()];

    return {
        ...baseTransaction,
        aliasAction: Constants.AliasAction[transaction.aliasAction],
        namespaceId: transaction.namespaceId.id.toHex(),
        namespaceName,
        mosaicId: transaction.mosaicId.id.toHex(),
    };
};

export const mosaicDefinitionTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    //const resolvedMosaic = await NamespaceService.resolveMosaicId(transaction.mosaicId, network);

    return {
        ...baseTransaction,
        mosaicId: transaction.mosaicId.toHex(),
        divisibility: transaction.divisibility,
        duration: transaction.duration.compact(),
        nonce: transaction.nonce.toHex(),
        supplyMutable: transaction.flags.supplyMutable,
        transferable: transaction.flags.transferable,
        restrictable: transaction.flags.restrictable,
        revokable: transaction.flags.revokable,
    };
};

export const mosaicSupplyChangeTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    //const resolvedMosaic = await NamespaceService.resolveMosaicId(transaction.mosaicId, network);

    return {
        ...baseTransaction,
        mosaicId: transaction.mosaicId.toHex(),
        action: Constants.MosaicSupplyChangeAction[transaction.action],
        delta: transaction.delta.compact(),
    };
};

export const mosaicSupplyRevocationTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const mosaic = mosaicFromDTO(transaction.mosaic);
    const formattedMosaics = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const sourceAddress = addressFromDTO(transaction.sourceAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        mosaicId: transaction.mosaic.id.toHex(),
        mosaics: formattedMosaics,
        sourceAddress
    };
};

export const multisigAccountModificationTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const addressAdditions = transaction.addressAdditions.map(address => addressFromDTO(address, config.resolvedAddresses));
    const addressDeletions = transaction.addressDeletions.map(address => addressFromDTO(address, config.resolvedAddresses));

    return {
        ...baseTransaction,
        minApprovalDelta: transaction.minApprovalDelta,
        minRemovalDelta: transaction.minRemovalDelta,
        addressAdditions: addressAdditions,
        addressDeletions: addressDeletions,
    };
};

export const hashLockTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const mosaic = mosaicFromDTO(transaction.mosaic);
    const formattedMosaics = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const amount = -formattedMosaics[0].amount;

    return {
        ...baseTransaction,
        duration: transaction.duration.compact(),
        mosaics: formattedMosaics,
        amount,
    };
};

export const secretLockTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const mosaic = mosaicFromDTO(transaction.mosaic);
    const formattedMosaics = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const resolvedAddress = addressFromDTO(transaction.recipientAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        duration: transaction.duration.compact(),
        secret: transaction.secret,
        recipientAddress: resolvedAddress,
        hashAlgorithm: Constants.LockHashAlgorithm[transaction.hashAlgorithm],
        mosaics: formattedMosaics,
    };
};

export const secretProofTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const resolvedAddress = addressFromDTO(transaction.recipientAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        hashAlgorithm: Constants.LockHashAlgorithm[transaction.hashAlgorithm],
        recipientAddress: resolvedAddress,
        secret: transaction.secret,
        proof: transaction.proof,
    };
};

export const accountAddressRestrictionTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const addressAdditions = transaction.restrictionAdditions.map(address => addressFromDTO(address, config.resolvedAddresses));
    const addressDeletions = transaction.restrictionDeletions.map(address => addressFromDTO(address, config.resolvedAddresses));

    return {
        ...baseTransaction,
        restrictionType: Constants.AddressRestrictionFlag[transaction.restrictionFlags],
        restrictionAddressAdditions: addressAdditions,
        restrictionAddressDeletions: addressDeletions,
    };
};

export const accountMosaicRestrictionTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);

    return {
        ...baseTransaction,
        restrictionType: Constants.MosaicRestrictionFlag[transaction.restrictionFlags],
        restrictionMosaicAdditions: transaction.restrictionAdditions.map(restriction => restriction.id.toHex()),
        restrictionMosaicDeletions: transaction.restrictionDeletions.map(restriction => restriction.id.toHex()),
    };
};

export const accountOperationRestrictionTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);

    return {
        ...baseTransaction,
        restrictionType: Constants.OperationRestrictionFlag[transaction.restrictionFlags],
        restrictionOperationAdditions: transaction.restrictionAdditions.map(operation => operation),
        restrictionOperationDeletions: transaction.restrictionDeletions.map(operation => operation),
    };
};

export const mosaicAddressRestrictionTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const mosaicId = transaction.mosaicId.toHex();
    const mosaicName = config.mosaicInfos[mosaicId]?.name;
    const targetAddress = addressFromDTO(transaction.targetAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        restrictionKey: transaction.restrictionKey.toHex(),
        newRestrictionValue: transaction.newRestrictionValue.toString(),
        previousRestrictionValue: transaction.previousRestrictionValue.toString(),
        mosaicId,
        mosaicName,
        targetAddress,
    };
};

export const mosaicGlobalRestrictionTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const referenceMosaicId =
        transaction.referenceMosaicId.toHex() === '0000000000000000' ? transaction.mosaicId : transaction.referenceMosaicId;
    const mosaicName = config.mosaicInfos[referenceMosaicId]?.name;

    return {
        ...baseTransaction,
        restrictionKey: transaction.restrictionKey.toHex(),
        newRestrictionType: Constants.MosaicRestrictionType[transaction.newRestrictionType],
        newRestrictionValue: transaction.newRestrictionValue.compact(),
        previousRestrictionType: Constants.MosaicRestrictionType[transaction.previousRestrictionType],
        previousRestrictionValue: transaction.previousRestrictionValue.compact(),
        referenceMosaicId: referenceMosaicId.toHex(),
        mosaicName,
    };
};

export const accountMetadataTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const targetAddress = addressFromDTO(transaction.targetAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        scopedMetadataKey: transaction.scopedMetadataKey.toHex(),
        targetAddress,
        metadataValue: transaction.value,
        valueSizeDelta: transaction.valueSizeDelta,
    };
};

export const mosaicMetadataTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const mosaicId = transaction.targetMosaicId.toHex();
    const mosaicName = config.mosaicInfos[mosaicId]?.name
    const targetAddress = addressFromDTO(transaction.targetAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        scopedMetadataKey: transaction.scopedMetadataKey.toHex(),
        targetMosaicId: mosaicId,
        targetMosaicName: mosaicName,
        targetAddress,
        metadataValue: transaction.value,
        valueSizeDelta: transaction.valueSizeDelta,
    };
};

export const namespaceMetadataTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const targetAddress = addressFromDTO(transaction.targetAddress, config.resolvedAddresses);
    const namespaceName = config.namespaceNames[transaction.targetNamespaceId];

    return {
        ...baseTransaction,
        scopedMetadataKey: transaction.scopedMetadataKey.toHex(),
        metadataValue: transaction.value,
        valueSizeDelta: transaction.valueSizeDelta,
        targetNamespaceId: transaction.targetNamespaceId.toHex(),
        namespaceName,
        targetAddress,
    };
};

export const votingKeyLinkTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const linkedAccountAddress = addressFromPublicKey(transaction.linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: Constants.LinkAction[transaction.linkAction],
        linkedPublicKey: transaction.linkedPublicKey,
        linkedAccountAddress,
        startEpoch: transaction.startEpoch,
        endEpoch: transaction.endEpoch,
    };
};

export const vrfKeyLinkTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const linkedAccountAddress = addressFromPublicKey(transaction.linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: Constants.LinkAction[transaction.linkAction],
        linkedPublicKey: transaction.linkedPublicKey,
        linkedAccountAddress,
    };
};

export const nodeKeyLinkTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const linkedAccountAddress = addressFromPublicKey(transaction.linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: Constants.LinkAction[transaction.linkAction],
        linkedPublicKey: transaction.linkedPublicKey,
        linkedAccountAddress,
    };
};

export const accountKeyLinkTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const linkedAccountAddress = addressFromPublicKey(transaction.linkedPublicKey, config.networkProperties.networkIdentifier);

    return {
        ...baseTransaction,
        linkAction: Constants.LinkAction[transaction.linkAction],
        linkedPublicKey: transaction.linkedPublicKey,
        linkedAccountAddress,
    };
};
