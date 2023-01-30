import { Address, Crypto, Deadline, EncryptedMessage, Mosaic, MosaicId, PlainMessage, TransactionType, TransferTransaction, UInt64 } from 'symbol-sdk';
import { toFixedNumber } from './helper';
import { getMosaicRelativeAmount } from './mosaic';
import { networkIdentifierToNetworkType } from './network';

export const isAggregateTransaction = transaction => {
    return transaction.type === TransactionType.AGGREGATE_BONDED
        || transaction.type === TransactionType.AGGREGATE_COMPLETE;
}

export const getGroupFromtransactionDTO = transaction => {
    if (transaction.isConfirmed())
        return 'confirmed';
    if (transaction.isUnconfirmed())
        return 'unconfirmed';
    return 'partial';
};

export const formatDeadline = (date) => `${date.dayOfMonth()}/${date.monthValue()}/${date.year()}`;

export const getTransactionFees = (transaction, networkProperties) => {
    const { transactionFees, networkCurrency: { divisibility } } = networkProperties;
    const stubTransaction = {
        ...transaction,
        recipientPublicKey: '1111111111111111111111111111111111111111111111111111111111111111',
        recipientAddress: 'TB3KUBHATFCPV7UZQLWAQ2EUR6SIHBSBEOEDDDF' 
    };
    const stubCurrentAccount = {
        privateKey: '0000000000000000000000000000000000000000000000000000000000000000'
    };
    const size = transferTransactionToDTO(stubTransaction, networkProperties, stubCurrentAccount).size;

    const fast = (transactionFees.minFeeMultiplier + transactionFees.averageFeeMultiplier)* size;
    const medium = (transactionFees.minFeeMultiplier + transactionFees.averageFeeMultiplier * 0.65) * size;
    const slow = (transactionFees.minFeeMultiplier + transactionFees.averageFeeMultiplier * 0.35) * size;

    return {
        fast: toFixedNumber(getMosaicRelativeAmount(fast, divisibility), divisibility),
        medium: toFixedNumber(getMosaicRelativeAmount(medium, divisibility), divisibility),
        slow: toFixedNumber(getMosaicRelativeAmount(slow, divisibility), divisibility),
    }
}

export const transferTransactionToDTO = (transaction, networkProperties, currentAccount) => {
    let message;

    if (transaction.messageEncrypted) {
        message = EncryptedMessage.create(
            transaction.messageText,
            {publicKey: transaction.recipientPublicKey}, 
            currentAccount.privateKey
        );
    }
    else {
        message = PlainMessage.create(transaction.messageText)
    }
    return TransferTransaction.create(
        Deadline.create(networkProperties.epochAdjustment),
        Address.createFromRawAddress(transaction.recipientAddress),
        transaction.mosaics.map(mosaic => new Mosaic(
            new MosaicId(mosaic.id),
            UInt64.fromUint(mosaic.amount * Math.pow(10, mosaic.divisibility))
        )),
        message,
        networkIdentifierToNetworkType(networkProperties.networkIdentifier),
        UInt64.fromUint(transaction.fee * Math.pow(10, networkProperties.networkCurrency.divisibility))
    );
};

export const transferTransactionFromPayload = (payload) => {
    return TransferTransaction.createFromPayload(payload);
}

export const getUnresolvedIdsFromTransactionDTOs = transactions => {
    const mosaicIds = [];
    const namespaceIds = [];
    const addresses = [];

    const transactionsUnresolvedFieldsMap = {
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
            namespace: ['targetNamespaceId']
        },
    };

    transactions.forEach(transaction => {
        const transactionFieldsToResolve = transactionsUnresolvedFieldsMap[transaction.type];

        if (isAggregateTransaction(transaction)) {
            const unresolved = getUnresolvedIdsFromTransactionDTOs(transaction.innerTransactions);
            mosaicIds.push(...unresolved.mosaicIds);
            namespaceIds.push(...unresolved.namespaceIds);
            addresses.push(...unresolved.addresses);
        }

        if (!transactionFieldsToResolve) {
            return;
        }

        Object.keys(transactionFieldsToResolve).forEach(mode => {
            const fields = transactionFieldsToResolve[mode];

            fields.forEach(field => {
                const value = transaction[field];
                
                if (mode === 'address' && value.isNamespaceId()) {
                    addresses.push({
                        namespaceId: value.toHex(),
                        height: transaction.transactionInfo?.height
                    });
                }
                else if (mode === 'addressArray' && Array.isArray(value)) {
                    value
                        .filter(address => address.isNamespaceId())
                        .forEach(address => addresses.push({
                            namespaceId: address.toHex(),
                            height: transaction.transactionInfo?.height
                        }));
                }
                else if (mode === 'mosaic') {
                    mosaicIds.push(value.id.toHex());
                }
                else if (mode === 'mosaicArray' && Array.isArray(value)) {
                    value.forEach(mosaic => mosaicIds.push(mosaic.id.toHex()));
                }
                else if (mode === 'namespace') {
                    namespaceIds.push(value.toHex());
                }
                else if (mode === 'namespace') {
                    namespaceIds.push(value.toHex());
                }
            });
        });
    });
    
    return {
        mosaicIds: [...new Set(mosaicIds.flat())],
        namespaceIds: [...new Set(namespaceIds.flat())],
        addresses: [...new Set(addresses.flat())],
    };
};

export const isOutgoingTransaction = (transaction, currentAccount) => 
    transaction.signerAddress === currentAccount.address;

export const isIncomingTransaction = (transaction, currentAccount) => 
    transaction.recipientAddress === currentAccount.address;

export const decryptMessage = (encryptedMessage, recipientPrivateKey, senderPublicKey) => {
    const hex = Crypto.decode(recipientPrivateKey, senderPublicKey, encryptedMessage);

    return Buffer.from(hex, 'hex').toString();
}

/**
 * Checks whether transaction is awaiting a signature by account.
 */
export const transactionAwaitingSignatureByAccount = (transaction, account) => {
    if (transaction.type !== TransactionType.AGGREGATE_BONDED) {
        return false;
    }

    const isSignedByAccount = transaction.signerAddress === account.address;
    const hasAccountCosignature = transaction.receivedCosignatures.some(address => address === account.address);

    return !isSignedByAccount && !hasAccountCosignature;
};
