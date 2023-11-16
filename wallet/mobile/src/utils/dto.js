import { Constants, TransactionType } from 'src/config';
import {
    AccountKeyLinkTransaction,
    AccountMetadataTransaction,
    Address,
    AddressAliasTransaction,
    AggregateTransaction,
    AliasAction,
    Deadline,
    EncryptedMessage,
    HashLockTransaction,
    Id,
    LinkAction,
    Mosaic,
    MosaicAliasTransaction,
    MosaicDefinitionTransaction,
    MosaicFlags,
    MosaicId,
    MosaicMetadataTransaction,
    MosaicNonce,
    MosaicSupplyChangeAction,
    MosaicSupplyChangeTransaction,
    MosaicSupplyRevocationTransaction,
    NamespaceId,
    NamespaceMetadataTransaction,
    NamespaceRegistrationTransaction,
    NamespaceRegistrationType,
    NodeKeyLinkTransaction,
    PersistentDelegationRequestTransaction,
    PlainMessage,
    PublicAccount,
    TransferTransaction,
    UInt64,
    VotingKeyLinkTransaction,
    VrfKeyLinkTransaction,
} from 'symbol-sdk';
import {
    addressFromPublicKey,
    getMosaicRelativeAmount,
    getMosaicsWithRelativeAmounts,
    getNativeMosaicAmount,
    isIncomingTransaction,
    isOutgoingTransaction,
    networkIdentifierToNetworkType,
} from './';

export const mosaicFromDTO = (mosaic) => ({
    id: mosaic.id.toHex(),
    amount: parseInt(mosaic.amount.toString()),
});

export const addressFromDTO = (address, resolvedAddresses) =>
    address.isNamespaceId() ? resolvedAddresses[address.toHex()] : address.plain();

export const createSignerDTO = (transaction, networkProperties) => {
    return transaction.signerPublicKey
        ? PublicAccount.createFromPublicKey(
              transaction.signerPublicKey,
              networkIdentifierToNetworkType(networkProperties.networkIdentifier)
          )
        : null;
};

export const createMaxFeeDTO = (transaction, networkProperties) => {
    return UInt64.fromUint((transaction.fee || 0) * Math.pow(10, networkProperties.networkCurrency.divisibility));
};

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
};

export const transactionToDTO = (transaction, networkProperties, currentAccount) => {
    switch (transaction.type) {
        case TransactionType.AGGREGATE_BONDED:
        case TransactionType.AGGREGATE_COMPLETE:
            return aggregateTransactionToDTO(transaction, networkProperties, currentAccount);
        case TransactionType.TRANSFER:
            return transferTransactionToDTO(transaction, networkProperties, currentAccount);
        case TransactionType.ADDRESS_ALIAS:
            return addressAliasTransactionToDTO(transaction, networkProperties);
        case TransactionType.MOSAIC_ALIAS:
            return mosaicAliasTransactionToDTO(transaction, networkProperties);
        case TransactionType.NAMESPACE_REGISTRATION:
            return namespaceRegistrationTransactionToDTO(transaction, networkProperties, currentAccount);
        case TransactionType.MOSAIC_DEFINITION:
            return mosaicDefinitionTransactionToDTO(transaction, networkProperties);
        case TransactionType.MOSAIC_SUPPLY_CHANGE:
            return mosaicSupplyChangeTransactionToDTO(transaction, networkProperties);
        case TransactionType.MOSAIC_SUPPLY_REVOCATION:
            return mosaicSupplyRevocationTransactionToDTO(transaction, networkProperties);
        // case TransactionType.SECRET_LOCK:
        //     return secretLockTransactionToDTO(transaction, networkProperties);
        // case TransactionType.HASH_LOCK:
        //     return hashLockTransactionToDTO(transaction, networkProperties);
        // case TransactionType.SECRET_PROOF:
        //     return secretProofTransactionToDTO(transaction, networkProperties);
        case TransactionType.VRF_KEY_LINK:
            return vrfKeyLinkTransactionToDTO(transaction, networkProperties);
        case TransactionType.ACCOUNT_KEY_LINK:
            return accountKeyLinkTransactionToDTO(transaction, networkProperties);
        case TransactionType.NODE_KEY_LINK:
            return nodeKeyLinkTransactionToDTO(transaction, networkProperties);
        case TransactionType.VOTING_KEY_LINK:
            return votingKeyLinkTransactionToDTO(transaction, networkProperties);
        // case TransactionType.MOSAIC_GLOBAL_RESTRICTION:
        //     return mosaicGlobalRestrictionTransactionToDTO(transaction, networkProperties);
        // case TransactionType.MOSAIC_ADDRESS_RESTRICTION:
        //     return mosaicAddressRestrictionTransactionToDTO(transaction, networkProperties);
        // case TransactionType.ACCOUNT_OPERATION_RESTRICTION:
        //     return accountOperationRestrictionTransactionToDTO(transaction, networkProperties);
        // case TransactionType.ACCOUNT_ADDRESS_RESTRICTION:
        //     return accountAddressRestrictionTransactionToDTO(transaction, networkProperties);
        // case TransactionType.ACCOUNT_MOSAIC_RESTRICTION:
        //     return accountMosaicRestrictionTransactionToDTO(transaction, networkProperties);
        // case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
        //     return multisigAccountModificationTransactionToDTO(transaction, networkProperties);
        case TransactionType.ACCOUNT_METADATA:
            return accountMetadataTransactionToDTO(transaction, networkProperties);
        case TransactionType.NAMESPACE_METADATA:
            return namespaceMetadataTransactionToDTO(transaction, networkProperties);
        case TransactionType.MOSAIC_METADATA:
            return mosaicMetadataTransactionToDTO(transaction, networkProperties);
        case TransactionType.PERSISTENT_DELEGATION_REQUEST:
            return persistentDelegationRequestTransactionToDTO(transaction, networkProperties);
    }

    return null;
};

export const baseTransactionFromDTO = (transaction, config) => {
    const isSignerPublicKeyProvided =
        transaction.signer?.publicKey &&
        transaction.signer?.publicKey !== '0000000000000000000000000000000000000000000000000000000000000000';
    const signerPublicKey = isSignerPublicKeyProvided ? transaction.signer?.publicKey : config.fillSignerPublickey;

    return (baseTransaction = {
        type: transaction.type,
        deadline: transaction.deadline.toLocalDateTime(config.networkProperties.epochAdjustment).toString(),
        height: transaction.transactionInfo?.height.toString(),
        hash: transaction.transactionInfo?.hash,
        id: transaction.transactionInfo?.id,
        fee: getMosaicRelativeAmount(transaction.maxFee.toString(), config.networkProperties.networkCurrency.divisibility),
        signerAddress: isSignerPublicKeyProvided
            ? transaction.signer.address.plain()
            : !!signerPublicKey
            ? Address.createFromPublicKey(
                  signerPublicKey,
                  networkIdentifierToNetworkType(config.networkProperties.networkIdentifier)
              ).plain()
            : null,
        signerPublicKey,
    });
};

export const aggregateTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const innerTransactions = transaction.innerTransactions.map((innerTransaction) => transactionFromDTO(innerTransaction, config));
    const cosignaturePublicKeys = transaction.cosignatures.map((cosignature) => cosignature.signer.publicKey);
    const resultAmount = innerTransactions.reduce((accumulator, transaction) => accumulator + (transaction.amount || 0), 0);

    if (transaction.signer) {
        cosignaturePublicKeys.push(transaction.signer.publicKey);
    }

    const info = {
        ...baseTransaction,
        cosignaturePublicKeys: cosignaturePublicKeys,
        amount: resultAmount,
        innerTransactions,
    };

    if (transaction.type === TransactionType.AGGREGATE_BONDED) {
        info.receivedCosignatures = transaction.cosignatures.map((signature) => signature.signer.address.plain());
        info.signTransactionObject = transaction;
    }

    // if (transaction.cosignatures) {
    //     info.cosignatures = transaction.cosignatures.map((signature) => ({
    //         signerPublicKey: signature.signer.publicKey,
    //         signature: signature.signature,
    //         version: signature.version.toString()
    //     }));
    // }

    return info;
};

export const aggregateTransactionToDTO = (transaction, networkProperties, currentAccount) => {
    //const networkType = networkIdentifierToNetworkType(networkProperties.networkIdentifier);
    const innerTransactions = transaction.innerTransactions.map((innerTransaction) =>
        transactionToDTO(innerTransaction, networkProperties, currentAccount)
    );

    if (transaction.type === TransactionType.AGGREGATE_BONDED) {
        return AggregateTransaction.createBonded(
            Deadline.create(networkProperties.epochAdjustment),
            innerTransactions,
            networkIdentifierToNetworkType(networkProperties.networkIdentifier),
            [],
            // transaction.cosignatures
            //     ? transaction.cosignatures.map(signature => new AggregateTransactionCosignature(
            //         signature.signature,
            //         new PublicAccount.createFromPublicKey(signature.signerPublicKey, networkType),
            //         UInt64.fromNumericString(signature.version)
            //     ))
            //     : [],
            createMaxFeeDTO(transaction, networkProperties),
            undefined,
            createSignerDTO(transaction, networkProperties)
        );
    }

    return AggregateTransaction.createComplete(
        Deadline.create(networkProperties.epochAdjustment),
        innerTransactions,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        [],
        // transaction.cosignatures
        //     ? transaction.cosignatures.map(signature => new AggregateTransactionCosignature(
        //         signature.signature,
        //         new PublicAccount.createFromPublicKey(signature.signerPublicKey, networkType),
        //         UInt64.fromNumericString(signature.version)
        //     ))
        //     : [],
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
};

export const transferTransactionFromDTO = (transaction, config) => {
    const { networkProperties, mosaicInfos, currentAccount, resolvedAddresses } = config;
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const mosaics = transaction.mosaics.map(mosaicFromDTO);
    const formattedMosaics = getMosaicsWithRelativeAmounts(mosaics, mosaicInfos);
    const nativeMosaicAmount = getNativeMosaicAmount(formattedMosaics, networkProperties.networkCurrency.mosaicId);
    const transactionBody = {
        ...baseTransaction,
        recipientAddress: addressFromDTO(transaction.recipientAddress, resolvedAddresses),
    };
    let resultAmount = 0;

    if (isIncomingTransaction(transactionBody, currentAccount) && !isOutgoingTransaction(transactionBody, currentAccount)) {
        resultAmount = nativeMosaicAmount;
    } else if (!isIncomingTransaction(transactionBody, currentAccount) && isOutgoingTransaction(transactionBody, currentAccount)) {
        resultAmount = -nativeMosaicAmount;
    }

    const isMessageEncrypted = transaction.message.type === 1;
    const isDelegatedHarvestingMessage = transaction.message.type === 254;
    const messagePayload = transaction.message.payload;
    let message = null;

    if (messagePayload && !isMessageEncrypted) {
        message = {
            text: messagePayload,
            isEncrypted: isMessageEncrypted,
            isDelegatedHarvestingMessage,
        };
    } else if (messagePayload && isMessageEncrypted) {
        message = {
            encryptedText: messagePayload,
            isEncrypted: isMessageEncrypted,
        };
    }

    return {
        ...transactionBody,
        message,
        mosaics: formattedMosaics,
        amount: resultAmount,
    };
};

export const transferTransactionToDTO = (transaction, networkProperties, currentAccount) => {
    let message;

    if (transaction.message?.isEncrypted) {
        message = EncryptedMessage.create(
            transaction.message.text,
            { publicKey: transaction.recipientPublicKey },
            currentAccount.privateKey
        );
    } else {
        message = PlainMessage.create(transaction.message?.text);
    }
    return TransferTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        Address.createFromRawAddress(transaction.recipientAddress),
        transaction.mosaics.map(
            (mosaic) => new Mosaic(new MosaicId(mosaic.id), UInt64.fromUint(mosaic.amount * Math.pow(10, mosaic.divisibility)))
        ),
        message,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
};

export const namespaceRegistrationTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);

    return {
        ...baseTransaction,
        registrationType: Constants.NamespaceRegistrationType[transaction.registrationType],
        namespaceName: transaction.namespaceName,
        namespaceId: transaction.namespaceId.toHex(),
        parentId: typeof transaction.parentId !== 'undefined' ? transaction.parentId?.toHex() : '',
        duration: typeof transaction.duration !== 'undefined' ? transaction.duration?.compact() : Constants.Message.UNLIMITED,
    };
};

export const namespaceRegistrationTransactionToDTO = (transaction, networkProperties) => {
    if (transaction.registrationType === Constants.NamespaceRegistrationType[NamespaceRegistrationType.RootNamespace]) {
        return NamespaceRegistrationTransaction.createRootNamespace(
            Deadline.create(networkProperties.epochAdjustment),
            transaction.namespaceName,
            UInt64.fromUint(transaction.duration),
            networkIdentifierToNetworkType(networkProperties.networkIdentifier),
            createMaxFeeDTO(transaction, networkProperties),
            undefined,
            createSignerDTO(transaction, networkProperties)
        );
    } else {
        return NamespaceRegistrationTransaction.createSubNamespace(
            Deadline.create(networkProperties.epochAdjustment),
            transaction.namespaceName,
            transaction.parentId,
            networkIdentifierToNetworkType(networkProperties.networkIdentifier),
            createMaxFeeDTO(transaction, networkProperties),
            undefined,
            createSignerDTO(transaction, networkProperties)
        );
    }
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

export const addressAliasTransactionToDTO = (transaction, networkProperties) => {
    return AddressAliasTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        Constants.AliasAction[AliasAction.Link] === transaction.aliasAction ? AliasAction.Link : AliasAction.Unlink,
        new NamespaceId([Id.fromHex(transaction.namespaceId).lower, Id.fromHex(transaction.namespaceId).higher]),
        Address.createFromRawAddress(transaction.address),
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
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

export const mosaicAliasTransactionToDTO = (transaction, networkProperties) => {
    return MosaicAliasTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        Constants.AliasAction[AliasAction.Link] === transaction.aliasAction ? AliasAction.Link : AliasAction.Unlink,
        new NamespaceId([Id.fromHex(transaction.namespaceId).lower, Id.fromHex(transaction.namespaceId).higher]),
        new MosaicId(transaction.mosaicId),
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
};

export const mosaicDefinitionTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);

    return {
        ...baseTransaction,
        mosaicId: transaction.mosaicId.toHex(),
        divisibility: transaction.divisibility,
        duration: transaction.duration.compact(),
        nonce: transaction.nonce.toHex(),
        isSupplyMutable: transaction.flags.supplyMutable,
        isTransferable: transaction.flags.transferable,
        isRestrictable: transaction.flags.restrictable,
        isRevokable: transaction.flags.revokable,
    };
};

export const mosaicDefinitionTransactionToDTO = (transaction, networkProperties) => {
    return MosaicDefinitionTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        MosaicNonce.createFromHex(transaction.nonce),
        new MosaicId(transaction.mosaicId),
        MosaicFlags.create(transaction.isSupplyMutable, transaction.isTransferable, transaction.isRestrictable, transaction.isRevokable),
        transaction.divisibility,
        UInt64.fromUint(transaction.duration),
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
};

export const mosaicSupplyChangeTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);

    return {
        ...baseTransaction,
        mosaicId: transaction.mosaicId.toHex(),
        action: Constants.MosaicSupplyChangeAction[transaction.action],
        delta: transaction.delta.compact(),
    };
};

export const mosaicSupplyChangeTransactionToDTO = (transaction, networkProperties) => {
    const action =
        Constants.MosaicSupplyChangeAction[MosaicSupplyChangeAction.Increase] === transaction.action
            ? MosaicSupplyChangeAction.Increase
            : MosaicSupplyChangeAction.Decrease;

    return MosaicSupplyChangeTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        new MosaicId(transaction.mosaicId),
        action,
        UInt64.fromUint(transaction.delta),
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
};

export const mosaicSupplyRevocationTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const mosaic = mosaicFromDTO(transaction.mosaic);
    const formattedMosaics = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const sourceAddress = addressFromDTO(transaction.sourceAddress, config.resolvedAddresses);

    return {
        ...baseTransaction,
        mosaicId: transaction.mosaic.id.toHex(),
        mosaic: formattedMosaics[0],
        sourceAddress,
    };
};

export const mosaicSupplyRevocationTransactionToDTO = (transaction, networkProperties) => {
    return MosaicSupplyRevocationTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        Address.createFromRawAddress(transaction.sourceAddress),
        new Mosaic(
            new MosaicId(transaction.mosaic.id),
            UInt64.fromUint(transaction.mosaic.amount * Math.pow(10, transaction.mosaic.divisibility))
        ),
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
};

export const multisigAccountModificationTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
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

export const hashLockTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const mosaic = mosaicFromDTO(transaction.mosaic);
    const formattedMosaics = getMosaicsWithRelativeAmounts([mosaic], config.mosaicInfos);
    const lockedAmount = -formattedMosaics[0].amount;

    return {
        ...baseTransaction,
        duration: transaction.duration.compact(),
        mosaics: formattedMosaics,
        lockedAmount,
    };
};

export const hashLockTransactionToDTO = (networkProperties, signedTransaction, fee, duration = 1000) => {
    const amount = 10;

    return HashLockTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        new Mosaic(
            new MosaicId(networkProperties.networkCurrency.mosaicId),
            UInt64.fromUint(amount * Math.pow(10, networkProperties.networkCurrency.divisibility))
        ),
        UInt64.fromUint(duration),
        signedTransaction,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        UInt64.fromUint(fee * Math.pow(10, networkProperties.networkCurrency.divisibility))
    );
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
    const addressAdditions = transaction.restrictionAdditions.map((address) => addressFromDTO(address, config.resolvedAddresses));
    const addressDeletions = transaction.restrictionDeletions.map((address) => addressFromDTO(address, config.resolvedAddresses));

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
        restrictionMosaicAdditions: transaction.restrictionAdditions.map((restriction) => restriction.id.toHex()),
        restrictionMosaicDeletions: transaction.restrictionDeletions.map((restriction) => restriction.id.toHex()),
    };
};

export const accountOperationRestrictionTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);

    return {
        ...baseTransaction,
        restrictionType: Constants.OperationRestrictionFlag[transaction.restrictionFlags],
        restrictionOperationAdditions: transaction.restrictionAdditions.map((operation) => operation),
        restrictionOperationDeletions: transaction.restrictionDeletions.map((operation) => operation),
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

export const accountMetadataTransactionToDTO = (transaction, networkProperties) => {
    return AccountMetadataTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        Address.createFromRawAddress(transaction.targetAddress),
        UInt64.fromHex(transaction.scopedMetadataKey),
        transaction.valueSizeDelta,
        transaction.value,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
};

export const mosaicMetadataTransactionFromDTO = (transaction, config) => {
    const baseTransaction = baseTransactionFromDTO(transaction, config);
    const mosaicId = transaction.targetMosaicId.toHex();
    const mosaicName = config.mosaicInfos[mosaicId]?.name;
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

export const mosaicMetadataTransactionToDTO = (transaction, networkProperties) => {
    return MosaicMetadataTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        Address.createFromRawAddress(transaction.targetAddress),
        UInt64.fromHex(transaction.scopedMetadataKey),
        new MosaicId(transaction.targetMosaicId),
        transaction.valueSizeDelta,
        transaction.value,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
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

export const namespaceMetadataTransactionToDTO = (transaction, networkProperties) => {
    return NamespaceMetadataTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        Address.createFromRawAddress(transaction.targetAddress),
        UInt64.fromHex(transaction.scopedMetadataKey),
        new NamespaceId([Id.fromHex(transaction.targetNamespaceId).lower, Id.fromHex(transaction.targetNamespaceId).higher]),
        transaction.valueSizeDelta,
        transaction.value,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
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

export const votingKeyLinkTransactionToDTO = (transaction, networkProperties) => {
    return VotingKeyLinkTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        transaction.linkedPublicKey,
        Constants.LinkAction[LinkAction.Link] === transaction.linkAction ? LinkAction.Link : LinkAction.Unlink,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
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

export const vrfKeyLinkTransactionToDTO = (transaction, networkProperties) => {
    return VrfKeyLinkTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        transaction.linkedPublicKey,
        Constants.LinkAction[LinkAction.Link] === transaction.linkAction ? LinkAction.Link : LinkAction.Unlink,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
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

export const nodeKeyLinkTransactionToDTO = (transaction, networkProperties) => {
    return NodeKeyLinkTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        transaction.linkedPublicKey,
        Constants.LinkAction[LinkAction.Link] === transaction.linkAction ? LinkAction.Link : LinkAction.Unlink,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
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

export const accountKeyLinkTransactionToDTO = (transaction, networkProperties) => {
    return AccountKeyLinkTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        transaction.linkedPublicKey,
        Constants.LinkAction[LinkAction.Link] === transaction.linkAction ? LinkAction.Link : LinkAction.Unlink,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
};

export const persistentDelegationRequestTransactionToDTO = (transaction, networkProperties) => {
    return PersistentDelegationRequestTransaction.createPersistentDelegationRequestTransaction(
        Deadline.create(networkProperties.epochAdjustment),
        transaction.remoteAccountPrivateKey,
        transaction.vrfPrivateKey,
        transaction.nodePublicKey,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        createMaxFeeDTO(transaction, networkProperties),
        undefined,
        createSignerDTO(transaction, networkProperties)
    );
};
