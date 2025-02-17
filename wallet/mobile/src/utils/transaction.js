import { LinkAction, MessageType, TransactionType } from '@/app/constants';
import { getMosaicRelativeAmount } from './mosaic';
import { toFixedNumber } from './helper';
import { Hash256, PrivateKey, PublicKey, utils } from 'symbol-sdk';
import { MessageEncoder, SymbolFacade, models } from 'symbol-sdk/symbol';
import { transactionToSymbol } from './transaction-to-symbol';
import { addressFromPublicKey, generateKeyPair } from '@/app/utils/account';
const { TransactionFactory } = models;

const STUB_KEY_1 = 'BE0B4CF546B7B4F4BBFCFF9F574FDA527C07A53D3FC76F8BB7DB746F8E8E0A9F';
const STUB_KEY_2 = 'F312748473BFB2D61689F680AE5C6E4003FA7EE2B0EC407ADF82D15A1144CF4F';
const STUB_ADDRESS = 'TB3KUBHATFCPV7UZQLWAQ2EUR6SIHBSBEOEDDDF';

export const isAggregateTransaction = (transaction) => {
    const type = transaction.type || transaction.type?.value;

    return type === TransactionType.AGGREGATE_BONDED || type === TransactionType.AGGREGATE_COMPLETE;
};

export const getTransactionFees = (transaction, networkProperties) => {
    const { transactionFees } = networkProperties;
    const { divisibility } = networkProperties.networkCurrency;
    const stubTransaction = {
        ...transaction,
    };
    const transactionOptions = {
        networkProperties,
    };
    const size = transactionToSymbol(stubTransaction, transactionOptions).size;

    const fast = (transactionFees.minFeeMultiplier + transactionFees.averageFeeMultiplier) * size;
    const medium = (transactionFees.minFeeMultiplier + transactionFees.averageFeeMultiplier * 0.65) * size;
    const slow = (transactionFees.minFeeMultiplier + transactionFees.averageFeeMultiplier * 0.35) * size;

    return {
        fast: toFixedNumber(getMosaicRelativeAmount(fast, divisibility), divisibility),
        medium: toFixedNumber(getMosaicRelativeAmount(medium, divisibility), divisibility),
        slow: toFixedNumber(getMosaicRelativeAmount(slow, divisibility), divisibility),
    };
};

export const symbolTransactionFromPayload = (payload) => {
    const transactionHex = utils.hexToUint8(payload);

    return TransactionFactory.deserialize(transactionHex);
};

export const symbolTransactionToPayload = (symbolTransaction) => {
    const bytes = symbolTransaction.serialize();

    return utils.uint8ToHex(bytes);
};

export const transactionToPayload = (transaction, networkProperties) => {
    const symbolTransaction = transactionToSymbol(transaction, { networkProperties });

    return symbolTransactionToPayload(symbolTransaction);
};

export const createTransactionURI = (transactionPayload, generationHash) => {
    return `web+symbol://transaction?data=${transactionPayload}&generationHash=${generationHash}`;
};

export const isOutgoingTransaction = (transaction, currentAccount) => transaction.signerAddress === currentAccount.address;

export const isIncomingTransaction = (transaction, currentAccount) => transaction.recipientAddress === currentAccount.address;

export const encodePlainMessage = (messageText) => {
    const bytes = new TextEncoder().encode(messageText);

    return Buffer.from([MessageType.PlainText, ...bytes]).toString('hex');
};

export const decodePlainMessage = (messagePayloadHex) => {
    const messageBytes = Buffer.from(messagePayloadHex, 'hex');

    return Buffer.from(messageBytes.subarray(1)).toString();
};

export const encodeDelegatedHarvestingMessage = (privateKey, nodePublicKey, remotePrivateKey, vrfPrivateKey) => {
    const keyPair = new SymbolFacade.KeyPair(new PrivateKey(privateKey));
    const messageEncoder = new MessageEncoder(keyPair);
    const remoteKeyPair = new SymbolFacade.KeyPair(new PrivateKey(remotePrivateKey));
    const vrfKeyPair = new SymbolFacade.KeyPair(new PrivateKey(vrfPrivateKey));
    const encodedBytes = messageEncoder.encodePersistentHarvestingDelegation(new PublicKey(nodePublicKey), remoteKeyPair, vrfKeyPair);

    return Buffer.from(encodedBytes).toString('hex');
};

export const encryptMessage = (messageText, recipientPublicKey, privateKey) => {
    const _privateKey = new PrivateKey(privateKey);
    const _recipientPublicKey = new PublicKey(recipientPublicKey);
    const keyPair = new SymbolFacade.KeyPair(_privateKey);
    const messageEncoder = new MessageEncoder(keyPair);
    const messageBytes = Buffer.from(messageText, 'utf-8');
    const encodedBytes = messageEncoder.encodeDeprecated(_recipientPublicKey, messageBytes);

    return Buffer.from(encodedBytes).toString('hex');
};

export const decryptMessage = (encryptedMessageHex, recipientPublicKey, privateKey) => {
    const _privateKey = new PrivateKey(privateKey);
    const _recipientPublicKey = new PublicKey(recipientPublicKey);
    const keyPair = new SymbolFacade.KeyPair(_privateKey);
    const messageEncoder = new MessageEncoder(keyPair);
    const messageBytes = Buffer.from(encryptedMessageHex, 'hex');
    const { message } = messageEncoder.tryDecodeDeprecated(_recipientPublicKey, messageBytes);

    return Buffer.from(message).toString('utf-8');
};

/**
 * Checks whether transaction is awaiting a signature by account.
 */
export const isTransactionAwaitingSignatureByAccount = (transaction, account) => {
    if (transaction.type !== TransactionType.AGGREGATE_BONDED) {
        return false;
    }

    const isSignedByAccount = transaction.signerPublicKey === account.publicKey;
    const hasAccountCosignature = transaction.cosignatures.some((cosignature) => cosignature.signerPublicKey === account.publicKey);

    return !isSignedByAccount && !hasAccountCosignature;
};

export const filterAllowedTransactions = (transactions, blackList) => {
    return transactions.filter((transaction) => blackList.every((contact) => contact.address !== transaction.signerAddress));
};

export const filterBlacklistedTransactions = (transactions, blackList) => {
    return transactions.filter((transaction) => blackList.some((contact) => contact.address === transaction.signerAddress));
};

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

export const cosignTransaction = (networkProperties, transaction, privateKey) => {
    // Get signature
    const facade = new SymbolFacade(networkProperties.networkIdentifier);
    const keyPair = new SymbolFacade.KeyPair(new PrivateKey(privateKey));
    const hash256 = new Hash256(transaction.hash);
    const signature = facade.static.cosignTransactionHash(keyPair, hash256, true);

    return {
        dto: signature.toJson(),
        hash: transaction.hash,
    };
};

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
