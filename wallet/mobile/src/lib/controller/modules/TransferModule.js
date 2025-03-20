import { cloneDeep } from 'lodash';
import { makeAutoObservable } from 'mobx';
import { MessageType, TransactionType } from '@/app/constants';
import { AccountService, NamespaceService } from '@/app/lib/services';
import { encodePlainMessage, isIncomingTransaction, isOutgoingTransaction, isSymbolAddress } from '@/app/utils';
import { AppError } from '@/app/lib/error';
import * as TransactionTypes from '@/app/types/Transaction';

const defaultState = {};

export class TransferModule {
    constructor({ root, isObservable }) {
        this.name = 'transfer';
        this._state = cloneDeep(defaultState);

        if (isObservable) makeAutoObservable(this);

        this._root = root;
    }

    /**
     * Prepares a transfer transaction.
     * @param {object} options - The transfer options.
     * @param {string} options.senderPublicKey - The sender public key.
     * @param {string} options.recipientAddressOrAlias - The recipient address or alias.
     * @param {object[]} options.mosaics - The mosaics to transfer.
     * @param {string} options.messageText - The message text.
     * @param {boolean} options.isMessageEncrypted - The message encryption flag.
     * @param {string} [password] - The wallet password.
     * @returns {TransactionTypes.Transaction} The transfer transaction.
     */
    createTransaction = async (options, password) => {
        const { senderPublicKey, recipientAddressOrAlias, mosaics, messageText, isMessageEncrypted } = options;
        const { currentAccount, networkProperties } = this._root;
        const fee = 0;

        // Resolve recipient address
        let recipientAddress;
        if (isSymbolAddress(recipientAddressOrAlias)) recipientAddress = recipientAddressOrAlias;
        else {
            const namespaceId = namespaceIdFromName(recipientAddressOrAlias.toLowerCase());
            recipientAddress = await NamespaceService.resolveAddress(networkProperties, namespaceId);
        }

        if (!recipientAddress) {
            throw new AppError(
                'error_transfer_unknown_recipient',
                `Failed to create transfer transaction. Recipient address not found for provided alias "${recipientAddressOrAlias}"`
            );
        }

        // If message is encrypted, fetch recipient publicKey
        let messagePayloadHex = null;
        if (messageText && isMessageEncrypted) {
            const recipientAccount = await AccountService.fetchAccountInfo(networkProperties, recipientAddress);
            messagePayloadHex = await this._root.encryptMessage(messageText, recipientAccount.publicKey, password);
        }
        // If message is not encrypted, encode plain message
        else if (messageText && !isMessageEncrypted) {
            messagePayloadHex = encodePlainMessage(messageText);
        }

        // Prepare transfer transaction
        const transferTransaction = {
            type: TransactionType.TRANSFER,
            signerPublicKey: senderPublicKey || currentAccount.publicKey,
            recipientAddress,
            mosaics,
        };

        if (messagePayloadHex) {
            transferTransaction.message = {
                text: messageText,
                payload: messagePayloadHex,
                type: isMessageEncrypted ? MessageType.EncryptedText : MessageType.PlainText,
            };
        }

        // If multisig transaction, return aggregate bonded transaction
        const isMultisigTransaction = senderPublicKey !== currentAccount.publicKey;
        if (isMultisigTransaction) {
            return {
                type: TransactionType.AGGREGATE_BONDED,
                innerTransactions: [transferTransaction],
                signerPublicKey: currentAccount.publicKey,
                fee,
            };
        }

        // If not a multisig transaction, return transfer transaction
        transferTransaction.fee = fee;

        return transferTransaction;
    };

    /**
     * Decrypts the message payload of a transaction.
     * @param {TransactionTypes.Transaction} transaction - The transaction.
     * @param {string} [password] - The wallet password.
     * @returns {string} The decrypted message text.
     */
    getDecryptedMessageText = async (transaction, password) => {
        const { currentAccount, networkProperties } = this._root;

        if (transaction.type !== TransactionType.TRANSFER) {
            throw new AppError(
                'error_failed_decrypt_message_invalid_transaction_type',
                `Failed to decrypt message. Transaction type "${transaction.type}" is not supported. Expected type "${TransactionType.TRANSFER}"`
            );
        }

        const { message, recipientAddress, signerPublicKey } = transaction;

        if (!message.type === MessageType.EncryptedText) return message.payload;

        if (isIncomingTransaction(transaction, currentAccount))
            return this._root.decryptMessage(message.payload, signerPublicKey, password);

        if (isOutgoingTransaction(transaction, currentAccount)) {
            const recipientAccount = await AccountService.fetchAccountInfo(networkProperties, recipientAddress);

            return this._root.decryptMessage(message.payload, recipientAccount.publicKey, password);
        }

        throw new AppError(
            'error_failed_decrypt_message_not_related',
            'Failed to decrypt message. Transaction is not related to current account'
        );
    };
}
