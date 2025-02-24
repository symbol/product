import { LinkAction, MessageType, TransactionType } from '@/app/constants';
import { absoluteToRelativeAmount } from './mosaic';
import { toFixedNumber } from './helper';
import { Hash256, PrivateKey, PublicKey, utils } from 'symbol-sdk';
import { MessageEncoder, SymbolFacade, models } from 'symbol-sdk/symbol';
import { transactionToSymbol } from './transaction-to-symbol';
import { addressFromPublicKey, generateKeyPair } from '@/app/utils/account';
import * as AccountTypes from '@/app/types/Account';
import * as NetworkTypes from '@/app/types/Network';
import * as TransactionTypes from '@/app/types/Transaction';
const { TransactionFactory } = models;

const STUB_KEY_1 = 'BE0B4CF546B7B4F4BBFCFF9F574FDA527C07A53D3FC76F8BB7DB746F8E8E0A9F';
const STUB_KEY_2 = 'F312748473BFB2D61689F680AE5C6E4003FA7EE2B0EC407ADF82D15A1144CF4F';
const STUB_ADDRESS = 'TB3KUBHATFCPV7UZQLWAQ2EUR6SIHBSBEOEDDDF';

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
 * Calculates the transaction fees for a given transaction.
 * @param {TransactionTypes.Transaction} transaction - The transaction object.
 * @param {NetworkTypes.NetworkProperties} networkProperties - The network properties.
 * @returns {NetworkTypes.TransactionFees} The transaction fees.
 */
export const calculateTransactionFees = (transaction, networkProperties) => {
    const { transactionFees } = networkProperties;
    const { divisibility } = networkProperties.networkCurrency;
    const transactionOptions = {
        networkProperties,
    };
    const size = transactionToSymbol(transaction, transactionOptions).size;

    const fast = (transactionFees.minFeeMultiplier + transactionFees.averageFeeMultiplier) * size;
    const medium = (transactionFees.minFeeMultiplier + transactionFees.averageFeeMultiplier * 0.65) * size;
    const slow = (transactionFees.minFeeMultiplier + transactionFees.averageFeeMultiplier * 0.35) * size;

    return {
        fast: toFixedNumber(absoluteToRelativeAmount(fast, divisibility), divisibility),
        medium: toFixedNumber(absoluteToRelativeAmount(medium, divisibility), divisibility),
        slow: toFixedNumber(absoluteToRelativeAmount(slow, divisibility), divisibility),
    };
};

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
 * Creates a transaction URI.
 * @param {string} transactionPayload - The transaction payload.
 * @param {string} generationHash - The network generation hash.
 * @returns {string} The transaction URI.
 */
export const createTransactionURI = (transactionPayload, generationHash) => {
    return `web+symbol://transaction?data=${transactionPayload}&generationHash=${generationHash}`;
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
 * Filters transactions by allowed contacts.
 * @param {TransactionTypes.Transaction[]} transactions - The transactions array.
 * @param {AccountTypes.PublicAccount[]} blackList - The blacklisted contacts array.
 * @returns {TransactionTypes.Transaction[]} The filtered transactions array.
 */
export const filterAllowedTransactions = (transactions, blackList) => {
    return transactions.filter((transaction) => blackList.every((contact) => contact.address !== transaction.signerAddress));
};

/**
 * Filters transactions by blacklisted contacts.
 * @param {TransactionTypes.Transaction[]} transactions - The transactions array.
 * @param {AccountTypes.PublicAccount[]} blackList - The blacklisted contacts array.
 */
export const filterBlacklistedTransactions = (transactions, blackList) => {
    return transactions.filter((transaction) => blackList.some((contact) => contact.address === transaction.signerAddress));
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

    if (hasUnrelatedTypes || !hasKeyLinkTransaction) {
        return false;
    }

    const hasTransferTransactionWrongMessage = !!transferTransactions[0] && !transferTransactions[0].message?.isDelegatedHarvestingMessage;

    if (transferTransactions.length > 1 || hasTransferTransactionWrongMessage) {
        return false;
    }

    return true;
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

export const createSingleTransferTransactionStub = ({ messageText, isMessageEncrypted, mosaics = [] }) => {
    let messagePayloadHex;
    let messageType;

    const transaction = {
        type: TransactionType.TRANSFER,
        signerPublicKey: STUB_KEY_1,
        recipientAddress: STUB_ADDRESS,
        mosaics,
    };

    if (!messageText) return transaction;

    if (isMessageEncrypted) {
        messagePayloadHex = encryptMessage(messageText, STUB_KEY_2, STUB_KEY_1);
        messageType = MessageType.EncryptedMessage;
    } else {
        messagePayloadHex = encodePlainMessage(messageText);
        messageType = MessageType.PlainMessage;
    }

    transaction.message = {
        text: messageText,
        payload: messagePayloadHex,
        type: messageType,
    };

    return transaction;
};

export const createMultisigTransferTransactionStub = ({ messageText, isMessageEncrypted, mosaics = [] }) => {
    const transferTransaction = createSingleTransferTransactionStub({ messageText, isMessageEncrypted, mosaics });

    const transaction = {
        type: TransactionType.AGGREGATE_BONDED,
        signerPublicKey: STUB_KEY_1,
        innerTransactions: [transferTransaction],
    };

    return transaction;
};

export const createHarvestingTransactionStub = ({ networkIdentifier, linkedKeys, type = 'start' }) => {
    const account = generateKeyPair();
    const nodePublicKey = generateKeyPair().publicKey;
    const nodeAddress = addressFromPublicKey(nodePublicKey, networkIdentifier);
    const vrfAccount = generateKeyPair();
    const remoteAccount = generateKeyPair();
    const transactions = [];

    const isVrfKeyLinked = !!linkedKeys.vrfPublicKey;
    const isRemoteKeyLinked = !!linkedKeys.linkedPublicKey;
    const isNodeKeyLinked = !!linkedKeys.nodePublicKey;

    if ((type === 'start' && isVrfKeyLinked) || type === 'stop') {
        transactions.push({
            type: TransactionType.VRF_KEY_LINK,
            linkAction: LinkAction[LinkAction.Unlink],
            linkedPublicKey: linkedKeys.vrfPublicKey,
            signerPublicKey: account.publicKey,
        });
    }
    if ((type === 'start' && isRemoteKeyLinked) || type === 'stop') {
        transactions.push({
            type: TransactionType.ACCOUNT_KEY_LINK,
            linkAction: LinkAction[LinkAction.Unlink],
            linkedPublicKey: linkedKeys.linkedPublicKey,
            signerPublicKey: account.publicKey,
        });
    }
    if ((type === 'start' && isNodeKeyLinked) || type === 'stop') {
        transactions.push({
            type: TransactionType.NODE_KEY_LINK,
            linkAction: LinkAction[LinkAction.Unlink],
            linkedPublicKey: linkedKeys.nodePublicKey,
            signerPublicKey: account.publicKey,
        });
    }

    if (type === 'start') {
        transactions.push({
            type: TransactionType.VRF_KEY_LINK,
            linkAction: LinkAction[LinkAction.Link],
            linkedPublicKey: vrfAccount.publicKey,
            signerPublicKey: account.publicKey,
        });
        transactions.push({
            type: TransactionType.ACCOUNT_KEY_LINK,
            linkAction: LinkAction[LinkAction.Link],
            linkedPublicKey: remoteAccount.publicKey,
            signerPublicKey: account.publicKey,
        });
        transactions.push({
            type: TransactionType.NODE_KEY_LINK,
            linkAction: LinkAction[LinkAction.Link],
            linkedPublicKey: nodePublicKey,
            signerPublicKey: account.publicKey,
        });
        transactions.push({
            type: TransactionType.TRANSFER,
            mosaics: [],
            message: {
                type: MessageType.DelegatedHarvesting,
                payload: encodeDelegatedHarvestingMessage(
                    account.privateKey,
                    nodePublicKey,
                    remoteAccount.privateKey,
                    vrfAccount.privateKey
                ),
                text: '',
            },
            remoteAccountPrivateKey: remoteAccount.privateKey,
            vrfPrivateKey: vrfAccount.privateKey,
            nodePublicKey: nodePublicKey,
            signerPublicKey: account.publicKey,
            recipientAddress: nodeAddress,
        });
    }

    const aggregateTransaction = {
        type: TransactionType.AGGREGATE_COMPLETE,
        innerTransactions: transactions,
        signerPublicKey: account.publicKey,
        fee: 0,
    };

    return aggregateTransaction;
};
