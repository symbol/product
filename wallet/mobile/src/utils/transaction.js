import { MessageType, TransactionType } from '@/app/constants';
import { Hash256, PrivateKey, PublicKey, utils } from 'symbol-sdk';
import { MessageEncoder, SymbolFacade, models } from 'symbol-sdk/symbol';
import { transactionToSymbol } from './transaction-to-symbol';
import * as AccountTypes from '@/app/types/Account';
import * as NetworkTypes from '@/app/types/Network';
import * as TransactionTypes from '@/app/types/Transaction';
const { TransactionFactory } = models;

/**
 * Checks if a transaction is an aggregate transaction.
 * @param {TransactionTypes.Transaction | Object} transaction - The transaction or Symbol transaction object.
 * @returns {boolean} A boolean indicating whether the transaction is an aggregate transaction.
 */
export const isAggregateTransaction = (transaction) => {
    const type = transaction.type || transaction.type?.value;

    return type === TransactionType.AGGREGATE_BONDED || type === TransactionType.AGGREGATE_COMPLETE;
};

/**
 * Checks if a transaction is a harvesting service transaction. It should contain a VRF, remote and node key link transactions and a transfer transaction with a delegated harvesting message.
 * @param {TransactionTypes.Transaction} transaction - The transaction object.
 * @returns {boolean} A boolean indicating whether the transaction is a harvesting service transaction.
 */
export const isHarvestingServiceTransaction = (transaction) => {
    if (!isAggregateTransaction(transaction)) {
        return false;
    }

    const keyLinkTypes = [TransactionType.ACCOUNT_KEY_LINK, TransactionType.VRF_KEY_LINK, TransactionType.NODE_KEY_LINK];

    let hasKeyLinkTransaction = false;
    let hasUnrelatedTypes = false;
    const transferTransactions = [];

    transaction.innerTransactions.forEach((innerTransaction) => {
        const isKeyLinkTransaction = keyLinkTypes.some((type) => type === innerTransaction.type);
        if (isKeyLinkTransaction) {
            hasKeyLinkTransaction = true;
            return;
        }

        const isTransferTransaction = innerTransaction.type === TransactionType.TRANSFER;
        if (isTransferTransaction) {
            transferTransactions.push(innerTransaction);
            return;
        }

        hasUnrelatedTypes = true;
    });

    // If there are unrelated transaction types or more than one transfer transaction, it is not a harvesting service transaction
    if (hasUnrelatedTypes || transferTransactions.length > 1) {
        return false;
    }

    const hasTransferTransaction = transferTransactions.length === 1;
    const hasOneHarvestingRequestTransfer =
        hasTransferTransaction && transferTransactions[0].message?.type === MessageType.DelegatedHarvesting;

    // If there is a key link transaction or one transfer transaction with a delegated harvesting message, it is a harvesting service transaction
    if ((hasKeyLinkTransaction && !hasTransferTransaction) || hasOneHarvestingRequestTransfer) {
        return true;
    }

    return false;
};

/**
 * Checks whether transaction is awaiting a signature by account.
 * @param {TransactionTypes.Transaction} transaction - The transaction object.
 * @param {AccountTypes.PublicAccount} account - The account object.
 * @returns {boolean} A boolean indicating whether the transaction is awaiting a signature by the account.
 */
export const isTransactionAwaitingSignatureByAccount = (transaction, account) => {
    if (transaction.type !== TransactionType.AGGREGATE_BONDED) {
        return false;
    }

    const isSignedByAccount = transaction.signerPublicKey === account.publicKey;
    const hasAccountCosignature = transaction.cosignatures.some((cosignature) => cosignature.signerPublicKey === account.publicKey);

    return !isSignedByAccount && !hasAccountCosignature;
};

/**
 * Checks if a transaction is an outgoing transaction.
 * @param {TransactionTypes.Transaction} transaction - Transaction.
 * @param {AccountTypes.PublicAccount} currentAccount - Current account.
 * @returns {boolean} A boolean indicating whether the transaction is an outgoing transaction.
 */
export const isOutgoingTransaction = (transaction, currentAccount) => transaction.signerAddress === currentAccount.address;

/**
 * Checks if a transaction is an incoming transaction.
 * @param {TransactionTypes.Transaction} transaction - Transaction.
 * @param {AccountTypes.PublicAccount} currentAccount - Current account.
 * @returns {boolean} A boolean indicating whether the transaction is an incoming transaction.
 */
export const isIncomingTransaction = (transaction, currentAccount) => transaction.recipientAddress === currentAccount.address;

/**
 * Creates a Symbol transaction object from a transaction payload string.
 * @param {string} payload - The transaction payload string.
 * @returns {Object} Resulting Symbol transaction object.
 */
export const symbolTransactionFromPayload = (payload) => {
    const transactionHex = utils.hexToUint8(payload);

    return TransactionFactory.deserialize(transactionHex);
};

/**
 * Creates a payload string from a Symbol transaction object.
 * @param {Object} symbolTransaction - The Symbol transaction object.
 * @returns {string} The resulting payload string.
 */
export const symbolTransactionToPayload = (symbolTransaction) => {
    const bytes = symbolTransaction.serialize();

    return utils.uint8ToHex(bytes);
};

/**
 * Creates a payload string from a transaction.
 * @param {TransactionTypes.Transaction} transaction - Transaction.
 * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
 * @returns {string} The resulting payload string.
 */
export const transactionToPayload = (transaction, networkProperties) => {
    const symbolTransaction = transactionToSymbol(transaction, { networkProperties });

    return symbolTransactionToPayload(symbolTransaction);
};

/**
 * Encodes a plain text message into a payload HEX string.
 * @param {string} messageText - The message text.
 * @returns {string} The resulting payload HEX string.
 */
export const encodePlainMessage = (messageText) => {
    const bytes = new TextEncoder().encode(messageText);

    return Buffer.from([MessageType.PlainText, ...bytes]).toString('hex');
};

/**
 * Decodes a plain text message from a payload HEX string.
 * @param {string} messagePayloadHex - The message payload HEX string.
 * @returns {string} The resulting message text.
 */
export const decodePlainMessage = (messagePayloadHex) => {
    const messageBytes = Buffer.from(messagePayloadHex, 'hex');

    return Buffer.from(messageBytes.subarray(1)).toString();
};

/**
 * Creates a delegated harvesting request message.
 * @param {string} privateKey - Current account private key.
 * @param {string} nodePublicKey - Node public key to delegate harvesting to.
 * @param {string} remotePrivateKey - The remote account private key.
 * @param {string} vrfPrivateKey - VRF private key.
 * @returns {string} The resulting payload HEX string.
 */
export const encodeDelegatedHarvestingMessage = (privateKey, nodePublicKey, remotePrivateKey, vrfPrivateKey) => {
    const keyPair = new SymbolFacade.KeyPair(new PrivateKey(privateKey));
    const messageEncoder = new MessageEncoder(keyPair);
    const remoteKeyPair = new SymbolFacade.KeyPair(new PrivateKey(remotePrivateKey));
    const vrfKeyPair = new SymbolFacade.KeyPair(new PrivateKey(vrfPrivateKey));
    const encodedBytes = messageEncoder.encodePersistentHarvestingDelegation(new PublicKey(nodePublicKey), remoteKeyPair, vrfKeyPair);

    return Buffer.from(encodedBytes).toString('hex');
};

/**
 * Encrypts a message with a recipient public key and a sender private key.
 * @param {string} messageText - The message text.
 * @param {string} recipientPublicKey - The recipient public key.
 * @param {string} privateKey - Current account private key.
 * @returns {string} The resulting payload HEX string.
 */
export const encryptMessage = (messageText, recipientPublicKey, privateKey) => {
    const _privateKey = new PrivateKey(privateKey);
    const _recipientPublicKey = new PublicKey(recipientPublicKey);
    const keyPair = new SymbolFacade.KeyPair(_privateKey);
    const messageEncoder = new MessageEncoder(keyPair);
    const messageBytes = Buffer.from(messageText, 'utf-8');
    const encodedBytes = messageEncoder.encodeDeprecated(_recipientPublicKey, messageBytes);

    return Buffer.from(encodedBytes).toString('hex');
};

/**
 * Decrypts a message with sender or recipient public key and current account private key.
 * @param {string} encryptedMessageHex - The encrypted message HEX string.
 * @param {string} senderOrRecipientPublicKey - The sender or recipient public key.
 * @param {string} privateKey - Current account private key.
 * @returns {string} The resulting message text.
 */
export const decryptMessage = (encryptedMessageHex, senderOrRecipientPublicKey, privateKey) => {
    const _privateKey = new PrivateKey(privateKey);
    const _senderOrRecipientPublicKey = new PublicKey(senderOrRecipientPublicKey);
    const keyPair = new SymbolFacade.KeyPair(_privateKey);
    const messageEncoder = new MessageEncoder(keyPair);
    const messageBytes = Buffer.from(encryptedMessageHex, 'hex');
    const { message } = messageEncoder.tryDecodeDeprecated(_senderOrRecipientPublicKey, messageBytes);

    return Buffer.from(message).toString('utf-8');
};

/**
 * Filters transactions by keeping only the transactions which signer is not blacklisted.
 * @param {TransactionTypes.Transaction[]} transactions - The transactions array.
 * @param {AccountTypes.PublicAccount[]} blackList - The blacklisted contacts array.
 * @returns {TransactionTypes.Transaction[]} The filtered transactions array.
 */
export const removeBlockedTransactions = (transactions, blackList) => {
    return transactions.filter((transaction) => blackList.every((contact) => contact.address !== transaction.signerAddress));
};

/**
 * Filters transactions by keeping only the transactions which signer is blacklisted.
 * @param {TransactionTypes.Transaction[]} transactions - The transactions array.
 * @param {AccountTypes.PublicAccount[]} blackList - The blacklisted contacts array.
 */
export const removeAllowedTransactions = (transactions, blackList) => {
    return transactions.filter((transaction) => blackList.some((contact) => contact.address === transaction.signerAddress));
};

/**
 * Signs a transaction with a private key.
 * @param {NetworkTypes.NetworkProperties} networkProperties - The network properties.
 * @param {TransactionTypes.Transaction} transaction - The transaction object.
 * @param {string} privateKey - The signer account private key.
 * @returns {TransactionTypes.SignedTransaction} The signed transaction.
 */
export const signTransaction = (networkProperties, transaction, privateKey) => {
    // Map transaction
    const transactionOptions = {
        networkProperties,
    };
    const transactionObject = transactionToSymbol(transaction, transactionOptions);

    // Get signature
    const facade = new SymbolFacade(networkProperties.networkIdentifier);
    const keyPair = new SymbolFacade.KeyPair(new PrivateKey(privateKey));
    const signature = facade.signTransaction(keyPair, transactionObject);

    // Attach signature
    const jsonString = facade.transactionFactory.constructor.attachSignature(transactionObject, signature);
    const hash = facade.hashTransaction(transactionObject).toString();

    return {
        dto: JSON.parse(jsonString),
        hash,
    };
};

/**
 * Cosigns a partial transaction with a private key.
 * @param {NetworkTypes.NetworkProperties}} networkProperties - The network properties.
 * @param {TransactionTypes.Transaction} transaction - The transaction object.
 * @param {string} privateKey - The cosigner account private key.
 * @returns {TransactionTypes.CosignedTransaction} The cosigned transaction.
 */
export const cosignTransaction = (networkProperties, transaction, privateKey) => {
    const facade = new SymbolFacade(networkProperties.networkIdentifier);
    const keyPair = new SymbolFacade.KeyPair(new PrivateKey(privateKey));
    const hash256 = new Hash256(transaction.hash);
    const signature = facade.static.cosignTransactionHash(keyPair, hash256, true);

    return {
        dto: signature.toJson(),
        hash: transaction.hash,
    };
};

/**
 * Gets unresolved data from transactions.
 * @param {TransactionTypes.Transaction[]} transactions - The transactions array.
 * @param {Object} config - The configuration object.
 * @param {Object.<string, string[]>} config.fieldsMap - The fields map.
 * @param {Function} config.mapNamespaceId - The namespace id mapper function.
 * @param {Function} config.mapMosaicId - The mosaic id mapper function.
 * @param {Function} config.mapTransactionType - The transaction type mapper function.
 * @param {Function} config.getBodyFromTransaction - The function to get the transaction body.
 * @param {Function} config.getHeightFromTransaction - The function to get the transaction height.
 * @param {Function} config.verifyAddress - The function to verify an address.
 * @returns {{ mosaicIds: string[], namespaceIds: string[], addresses: string[] }} The unresolved ids.
 */
export const getUnresolvedIdsFromTransactions = (transactions, config) => {
    const { fieldsMap, mapNamespaceId, mapMosaicId, mapTransactionType, getBodyFromTransaction, getHeightFromTransaction, verifyAddress } =
        config;
    const mosaicIds = [];
    const namespaceIds = [];
    const addresses = [];

    transactions.forEach((item) => {
        const transaction = getBodyFromTransaction(item);
        const transactionFieldsToResolve = fieldsMap[mapTransactionType(transaction.type)];

        if (isAggregateTransaction(transaction)) {
            const unresolved = getUnresolvedIdsFromTransactions(transaction.transactions, config);
            mosaicIds.push(...unresolved.mosaicIds);
            namespaceIds.push(...unresolved.namespaceIds);
            addresses.push(...unresolved.addresses);
        }

        if (!transactionFieldsToResolve) {
            return;
        }

        Object.keys(transactionFieldsToResolve).forEach((mode) => {
            const fields = transactionFieldsToResolve[mode];

            fields.forEach((field) => {
                const value = transaction[field];

                const processors = {
                    address: (value) => {
                        if (verifyAddress(value)) return;

                        addresses.push({
                            namespaceId: mapNamespaceId(value),
                            height: getHeightFromTransaction(item),
                        });
                    },
                    addressArray: (value) => {
                        if (!Array.isArray(value)) return;

                        value
                            .filter((address) => !verifyAddress(address))
                            .forEach((address) =>
                                addresses.push({
                                    namespaceId: mapNamespaceId(address),
                                    height: getHeightFromTransaction(transaction),
                                })
                            );
                    },
                    mosaic: (value) => {
                        const mosaicId = value?.mosaicId ?? value?.id ?? value;
                        mosaicIds.push(mapMosaicId(mosaicId));
                    },
                    mosaicArray: (value) => {
                        if (!Array.isArray(value)) return;

                        value.forEach((mosaic) => {
                            const mosaicId = mosaic?.mosaicId ?? mosaic?.id ?? mosaic;
                            mosaicIds.push(mapMosaicId(mosaicId));
                        });
                    },
                    namespace: (value) => {
                        namespaceIds.push(mapNamespaceId(value));
                    },
                };

                processors[mode](value);
            });
        });
    });

    return {
        mosaicIds: [...new Set(mosaicIds.flat())],
        namespaceIds: [...new Set(namespaceIds.flat())],
        addresses: [...new Set(addresses.flat())],
    };
};
