import { Address, TransactionType } from 'symbol-sdk';
import { formatDeadline, getNativeMosaicAmount, getMosaicRelativeAmount } from './';

export const mosaicFromDTO = mosaic => ({
    id: mosaic.id.toHex(),
    amount: parseInt(mosaic.amount.toString())
})

export const transactionFromDTO = (transaction, networkProperties) => {
    const baseTransaction = {
        type: transaction.type,
        date: formatDeadline(transaction.deadline.toLocalDateTime(networkProperties.epochAdjustment)),
        signerAddress: transaction.signer.address.plain(),
        hash: transaction.hash || transaction.transactionInfo?.hash,
    };

    if (transaction.type === TransactionType.TRANSFER) {
        baseTransaction.recipientAddress = transaction.recipientAddress instanceof Address
            ? transaction.recipientAddress.plain()
            : transaction.recipientAddress.id.toHex();

        const absoluteAmount = getNativeMosaicAmount(transaction.mosaics.map(mosaicFromDTO), networkProperties.networkCurrency.mosaicId);
        baseTransaction.amount = getMosaicRelativeAmount(absoluteAmount, networkProperties.networkCurrency.divisibility);
        baseTransaction.messageText = transaction.message.payload;
    };

    return baseTransaction;

    // switch (transaction.type) {
    //     case TransactionType.AGGREGATE_BONDED:
    //     case TransactionType.AGGREGATE_COMPLETE:
    //         return aggregateFromDTO(transaction);
    //     case TransactionType.TRANSFER:
    //         return transferTransactionFromDTO(transaction);
    //     case TransactionType.ADDRESS_ALIAS:
    //         return addressAliasTransactionFromDTO(transaction);
    //     case TransactionType.MOSAIC_ALIAS:
    //         return mosaicAliasTransactionFromDTO(transaction);
    //     case TransactionType.NAMESPACE_REGISTRATION:
    //         return namespaceRegistrationTransactionFromDTO(transaction);
    //     case TransactionType.MOSAIC_DEFINITION:
    //         return mosaicDefinitionTransactionFromDTO(transaction);
    //     case TransactionType.MOSAIC_SUPPLY_CHANGE:
    //         return mosaicSupplyChangeTransactionFromDTO(transaction);
    //     case TransactionType.SECRET_LOCK:
    //         return secretLockTransactionFromDTO(transaction);
    //     case TransactionType.HASH_LOCK:
    //         return hashLockTransactionFromDTO(transaction);
    //     case TransactionType.SECRET_PROOF:
    //         return secretProofTransactionFromDTO(transaction);
    //     case TransactionType.VRF_KEY_LINK:
    //         return vrfKeyLinkTransactionFromDTO(transaction);
    //     case TransactionType.ACCOUNT_KEY_LINK:
    //         return accountKeyLinkTransactionFromDTO(transaction);
    //     case TransactionType.NODE_KEY_LINK:
    //         return nodeKeyLinkTransactionFromDTO(transaction);
    //     case TransactionType.VOTING_KEY_LINK:
    //         return votingKeyLinkTransactionFromDTO(transaction);
    //     case TransactionType.MOSAIC_GLOBAL_RESTRICTION:
    //         return mosaicGlobalRestrictionTransactionFromDTO(transaction);
    //     case TransactionType.MOSAIC_ADDRESS_RESTRICTION:
    //         return mosaicAddressRestrictionTransactionFromDTO(transaction);
    //     case TransactionType.ACCOUNT_OPERATION_RESTRICTION:
    //         return accountOperationRestrictionTransactionFromDTO(transaction);
    //     case TransactionType.ACCOUNT_ADDRESS_RESTRICTION:
    //         return accountAddressRestrictionTransactionFromDTO(transaction);
    //     case TransactionType.ACCOUNT_MOSAIC_RESTRICTION:
    //         return accountMosaicRestrictionTransactionFromDTO(transaction);
    //     case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
    //         return multisigAccountModificationTransactionFromDTO(transaction);
    //     case TransactionType.ACCOUNT_METADATA:
    //         return accountMetadataTransactionFromDTO(transaction);
    //     case TransactionType.NAMESPACE_METADATA:
    //         return namespaceMetadataTransactionFromDTO(transaction);
    //     case TransactionType.MOSAIC_METADATA:
    //         return mosaicMetadataTransactionFromDTO(transaction);
    // }
}
