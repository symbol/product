import { LinkAction, MessageType, TransactionType } from '@/app/constants';
import { absoluteToRelativeAmount } from './mosaic';
import { toFixedNumber } from './helper';
import { transactionToSymbol } from './transaction-to-symbol';
import { addressFromPrivateKey, addressFromPublicKey, generateKeyPair } from '@/app/utils/account';
import * as AccountTypes from '@/app/types/Account';
import * as NetworkTypes from '@/app/types/Network';
import * as TransactionTypes from '@/app/types/Transaction';
import { encodeDelegatedHarvestingMessage, encodePlainMessage, encryptMessage } from '@/app/utils/transaction';

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
 * Creates a stub transfer transaction object with the given options.
 * Used for calculating transaction size and fees.
 * @param {object} options - The transaction options.
 * @param {string} options.networkIdentifier - The network identifier.
 * @param {string} options.messageText - The message text.
 * @param {boolean} options.isMessageEncrypted - The message encryption flag.
 * @param {array} options.mosaics - The mosaics.
 * @returns {TransactionTypes.Transaction} The transaction object.
 */
export const createSingleTransferTransactionStub = ({ networkIdentifier, messageText, isMessageEncrypted, mosaics = [] }) => {
    let messagePayloadHex;
    let messageType;
    const signerKeyPair = generateKeyPair();
    const recipientKeyPair = generateKeyPair();
    const transaction = {
        type: TransactionType.TRANSFER,
        signerPublicKey: signerKeyPair.publicKey,
        recipientAddress: addressFromPrivateKey(recipientKeyPair.privateKey, networkIdentifier),
        mosaics,
    };

    if (!messageText) return transaction;

    if (isMessageEncrypted) {
        messagePayloadHex = encryptMessage(messageText, recipientKeyPair.publicKey, signerKeyPair.privateKey);
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

/**
 * Creates a stub aggregate bonded transaction object with the given options.
 * Used for calculating transaction size and fees.
 * @param {object} options - The transaction options.
 * @param {string} options.networkIdentifier - The network identifier.
 * @param {string} options.messageText - The message text.
 * @param {boolean} options.isMessageEncrypted - The message encryption flag.
 * @param {array} options.mosaics - The mosaics.
 * @returns {TransactionTypes.Transaction} The transaction object.
 */
export const createMultisigTransferTransactionStub = (options) => {
    const signerKeyPair = generateKeyPair();
    const transferTransaction = createSingleTransferTransactionStub(options);
    const transaction = {
        type: TransactionType.AGGREGATE_BONDED,
        signerPublicKey: signerKeyPair.publicKey,
        innerTransactions: [transferTransaction],
    };

    return transaction;
};

/**
 * Creates a stub aggregate complete transaction object with the given options.
 * Used for calculating transaction size and fees.
 * @param {object} options - The transaction options.
 * @param {string} options.networkIdentifier - The network identifier.
 * @param {AccountTypes.LinkedKeys} options.linkedKeys - Current account linked keys.
 * @param {'start' | 'stop'} options.type - The harvesting action type.
 * @returns {TransactionTypes.Transaction} The transaction object.
 */
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
