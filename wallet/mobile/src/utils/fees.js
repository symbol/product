import { LinkAction, MessageType, TransactionType } from '@/app/constants';
import { absoluteToRelativeAmount } from './mosaic';
import { toFixedNumber } from './helper';
import { transactionToSymbol } from './transaction-to-symbol';
import * as AccountTypes from '@/app/types/Account';
import * as MosaicTypes from '@/app/types/Mosaic';
import * as NetworkTypes from '@/app/types/Network';
import * as TransactionTypes from '@/app/types/Transaction';
import { encodePlainMessage, encryptMessage } from '@/app/utils/transaction';

const KEY_PAIR_STUB_1 = {
    publicKey: 'A55C641506CE1A9E097A551DF9B6FC5C58AC9C22E6B0368EBAED0184CD9ADDAB',
    privateKey: '1793A85E07C164F8C48D33B291F50FA140DC50114BBEADBC8F48143D4AE08764',
};
const KEY_PAIR_STUB_2 = {
    publicKey: 'F94C017383A5FE74B5AB56B9EA09534E9C7F4DF299A80428C883B8124B60B710',
    privateKey: '88BD0C5BDFD361FB4D8CB3D78FECE2ACFEACF7A820F6C78A2F2D62EF83DE68D3',
};
const KEY_PAIR_STUB_3 = {
    publicKey: '103054F3037D759E52DCD6D61440846D57B1FAFEB10B5D7EF8F9D3EF85D82178',
    privateKey: '013117504BD8D5CEF95E0FE26FF2E7F4680E73F6C6C6B7428DBF28E2E0567D75',
};
const KEY_PAIR_STUB_4 = {
    publicKey: 'A0780ABAD74684FA00EAAF8A5000DBC31051FCAB701C37954D392DDB8FD99BF1',
    privateKey: '1D06ECB21234BF332A8A13D7E1FAE546D1DCD1DBF6BAACCE7D0822E86D70671B',
};
const ADDRESS_STUB = 'NALSBRWZTK3WQEGZ25NO4YH2MOU4SXYY6AVY72I';
const DELEGATED_HARVESTING_MESSAGE_STUB =
    'fe2a8061577301e261f0271414e15f79fb8feaefe2abcfaefc0642bd5714848aebe3a9c52344f0db0dbf9b86eb0004091fbf67d1994781a6d60bc79a98586adc797965b91eb6f96eb2b15d09690e03a99de607c3cc753e6f4efe76c181504a606fb40a120b732f20a67b0707be2f4155bebbf13238dc524ecbf753c07efe65aace62b960';

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
 * @param {string} options.messageText - The message text.
 * @param {boolean} options.isMessageEncrypted - The message encryption flag.
 * @param {MosaicTypes.Mosaic} options.mosaics - The mosaics.
 * @returns {TransactionTypes.Transaction} The transaction object.
 */
export const createSingleTransferTransactionStub = ({ messageText, isMessageEncrypted, mosaics = [] }) => {
    let messagePayloadHex;
    let messageType;
    const signerKeyPair = KEY_PAIR_STUB_1;
    const recipientKeyPair = KEY_PAIR_STUB_2;
    const transaction = {
        type: TransactionType.TRANSFER,
        signerPublicKey: signerKeyPair.publicKey,
        recipientAddress: ADDRESS_STUB,
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
 * @param {string} options.messageText - The message text.
 * @param {boolean} options.isMessageEncrypted - The message encryption flag.
 * @param {MosaicTypes.Mosaic} options.mosaics - The mosaics.
 * @returns {TransactionTypes.Transaction} The transaction object.
 */
export const createMultisigTransferTransactionStub = (options) => {
    const signerKeyPair = KEY_PAIR_STUB_1;
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
 * @param {AccountTypes.LinkedKeys} options.linkedKeys - Current account linked keys.
 * @param {'start' | 'stop'} options.type - The harvesting action type.
 * @returns {TransactionTypes.Transaction} The transaction object.
 */
export const createHarvestingTransactionStub = ({ linkedKeys, type = 'start' }) => {
    const account = KEY_PAIR_STUB_1;
    const nodePublicKey = KEY_PAIR_STUB_2.publicKey;
    const nodeAddress = ADDRESS_STUB;
    const vrfAccount = KEY_PAIR_STUB_3;
    const remoteAccount = KEY_PAIR_STUB_4;
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
                payload: DELEGATED_HARVESTING_MESSAGE_STUB,
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
