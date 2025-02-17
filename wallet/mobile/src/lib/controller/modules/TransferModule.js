import { cloneDeep } from 'lodash';
import { makeAutoObservable } from 'mobx';
import { MessageType, TransactionType } from '@/app/constants';
import { AccountService, NamespaceService } from '@/app/lib/services';
import { encodePlainMessage, isIncomingTransaction, isOutgoingTransaction, isSymbolAddress } from '@/app/utils';

const defaultState = {};

export class TransferModule {
    constructor({ root, isObservable }) {
        this.name = 'transfer';
        this._state = cloneDeep(defaultState);

        if (isObservable) makeAutoObservable(this);

        this._root = root;
    }

    createTransaction = async (options, password) => {
        const { senderPublicKey, recipientAddressOrAlias, mosaics, messageText, isMessageEncrypted } = options;
        const { currentAccount, networkProperties } = this._root;
        const fee = 0;

        // Resolve recipient address
        let recipientAddress;
        if (isSymbolAddress(recipientAddressOrAlias)) recipientAddress = recipientAddressOrAlias;
        else {
            recipientAddress = await NamespaceService.namespaceNameToAddress(networkProperties, recipientAddressOrAlias.toLowerCase());
        }

        if (!recipientAddress) {
            throw new Error('error_transfer_unknown_recipient');
        }

        // If message is encrypted, fetch recipient publicKey
        let messagePayloadHex = null;
        if (messageText && isMessageEncrypted) {
            const recipientAccount = await AccountService.fetchAccountInfo(networkProperties, recipientAddress);
            messagePayloadHex = this._root.encryptMessage(messageText, recipientAccount.publicKey, password);
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

    getDecryptedMessageText = async (transaction, password) => {
        const { currentAccount, networkProperties } = this._root;

        if (transaction.type !== TransactionType.TRANSFER) throw Error('error_failed_decrypt_message_invalid_transaction_type');

        const { message, recipientAddress, signerPublicKey } = transaction;

        if (!message.type === MessageType.EncryptedText) return message.payload;

        if (isIncomingTransaction(transaction, currentAccount))
            return this._root.decryptMessage(message.payload, signerPublicKey, password);

        if (isOutgoingTransaction(transaction, currentAccount)) {
            const recipientAccount = await AccountService.fetchAccountInfo(networkProperties, recipientAddress);

            return this._root.decryptMessage(message.payload, recipientAccount.publicKey, password);
        }

        throw Error('error_failed_decrypt_message_not_related');
    };
}
