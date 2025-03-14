import {
    cosignTransaction,
    decodePlainMessage,
    decryptMessage,
    encodeDelegatedHarvestingMessage,
    encodePlainMessage,
    encryptMessage,
    isAggregateTransaction,
    isHarvestingServiceTransaction,
    isIncomingTransaction,
    isOutgoingTransaction,
    isTransactionAwaitingSignatureByAccount,
    removeAllowedTransactions,
    removeBlockedTransactions,
    signTransaction,
    transactionToPayload,
} from '@/app/utils';
import { TransactionType } from '@/app/constants';
import { currentAccount, walletStorageAccounts } from '__fixtures__/local/wallet';
import { walletTransactions } from '__fixtures__/local/transactions';
import { payloads } from '__fixtures__/local/payloads';
import { networkProperties } from '__fixtures__/local/network';

const DELEGATED_HARVESTING_MESSAGE_TYPE = 254;
const ACCOUNT_KEY_LINK_TRANSACTION_TYPE = 16716;
const VRF_KEY_LINK_TRANSACTION_TYPE = 16963;
const NODE_KEY_LINK_TRANSACTION_TYPE = 16972;
const TRANSFER_TRANSACTION_TYPE = 16724;
const AGGREGATE_COMPLETE_TRANSACTION_TYPE = 16705;
const AGGREGATE_BONDED_TRANSACTION_TYPE = 16961;
const MULTISIG_ACCOUNT_TRANSACTION_TYPE = 16725;

const runIsAggregateTransactionTest = (transaction, expectedResult) => {
    // Act:
    const result = isAggregateTransaction(transaction);

    // Assert:
    expect(result).toBe(expectedResult);
};

describe('utils/transaction', () => {
    describe('isAggregateTransaction', () => {
        it('returns true for AGGREGATE_BONDED transaction', () => {
            // Arrange:
            const transaction = { type: TransactionType.AGGREGATE_BONDED };
            const expectedResult = true;

            // Act & Assert:
            runIsAggregateTransactionTest(transaction, expectedResult);
        });

        it('returns true for AGGREGATE_COMPLETE transaction', () => {
            // Arrange:
            const transaction = { type: AGGREGATE_COMPLETE_TRANSACTION_TYPE };
            const expectedResult = true;

            // Act & Assert:
            runIsAggregateTransactionTest(transaction, expectedResult);
        });

        it('returns false for non-aggregate transactions', () => {
            // Arrange:
            const transaction = { type: TransactionType.TRANSFER };
            const expectedResult = false;

            // Act & Assert:
            runIsAggregateTransactionTest(transaction, expectedResult);
        });
    });

    describe('isHarvestingServiceTransaction', () => {
        const runIsHarvestingServiceTransactionTest = (transaction, expectedResult) => {
            // Act:
            const result = isHarvestingServiceTransaction(transaction);

            // Assert:
            expect(result).toBe(expectedResult);
        };
        const createAggregateTransactionMock = (type, innerTransactions) => ({
            type,
            innerTransactions,
        });
        const createKeyLinkTransactionMock = (type) => ({ type });
        const createHarvestingRequestTransactionMock = () => ({
            type: TRANSFER_TRANSACTION_TYPE,
            message: { type: DELEGATED_HARVESTING_MESSAGE_TYPE },
        });
        const createTransferTransactionMock = () => ({
            type: TRANSFER_TRANSACTION_TYPE,
            message: { type: 0 },
        });
        const createMultisigAccountTransactionMock = () => ({
            type: MULTISIG_ACCOUNT_TRANSACTION_TYPE,
        });

        const keyLinkTransactionsTypes = [ACCOUNT_KEY_LINK_TRANSACTION_TYPE, VRF_KEY_LINK_TRANSACTION_TYPE, NODE_KEY_LINK_TRANSACTION_TYPE];

        it('returns true when aggregate has all key link and harvesting request inner transactions', () => {
            // Arrange:
            const transaction = createAggregateTransactionMock(AGGREGATE_COMPLETE_TRANSACTION_TYPE, [
                ...keyLinkTransactionsTypes.map(createKeyLinkTransactionMock),
                createHarvestingRequestTransactionMock(),
            ]);
            const expectedResult = true;

            // Act & Assert:
            runIsHarvestingServiceTransactionTest(transaction, expectedResult);
        });

        it('returns true aggregate has a key link inner transaction', () => {
            // Arrange:
            const transaction = createAggregateTransactionMock(AGGREGATE_COMPLETE_TRANSACTION_TYPE, [
                createKeyLinkTransactionMock(ACCOUNT_KEY_LINK_TRANSACTION_TYPE),
            ]);
            const expectedResult = true;

            // Act & Assert:
            runIsHarvestingServiceTransactionTest(transaction, expectedResult);
        });

        it('returns true aggregate has a harvesting request inner transaction', () => {
            // Arrange:
            const transaction = createAggregateTransactionMock(AGGREGATE_COMPLETE_TRANSACTION_TYPE, [
                createHarvestingRequestTransactionMock(),
            ]);
            const expectedResult = true;

            // Act & Assert:
            runIsHarvestingServiceTransactionTest(transaction, expectedResult);
        });

        it('return true when aggregate transaction is bonded', () => {
            // Arrange:
            const transaction = createAggregateTransactionMock(AGGREGATE_BONDED_TRANSACTION_TYPE, [
                createKeyLinkTransactionMock(ACCOUNT_KEY_LINK_TRANSACTION_TYPE),
            ]);
            const expectedResult = true;

            // Act & Assert:
            runIsHarvestingServiceTransactionTest(transaction, expectedResult);
        });

        it('returns false when aggregate has no key link or harvesting request inner transactions', () => {
            // Arrange:
            const transaction = createAggregateTransactionMock(AGGREGATE_COMPLETE_TRANSACTION_TYPE, []);
            const expectedResult = false;

            // Act & Assert:
            runIsHarvestingServiceTransactionTest(transaction, expectedResult);
        });

        it('returns false when transfer transaction does not contain request message', () => {
            // Arrange:
            const transaction = createAggregateTransactionMock(AGGREGATE_COMPLETE_TRANSACTION_TYPE, [
                createKeyLinkTransactionMock(ACCOUNT_KEY_LINK_TRANSACTION_TYPE),
                createTransferTransactionMock(),
            ]);
            const expectedResult = false;

            // Act & Assert:
            runIsHarvestingServiceTransactionTest(transaction, expectedResult);
        });

        it('returns false when unrelated inner transaction is present', () => {
            // Arrange:
            const transaction = createAggregateTransactionMock(AGGREGATE_COMPLETE_TRANSACTION_TYPE, [
                createKeyLinkTransactionMock(ACCOUNT_KEY_LINK_TRANSACTION_TYPE),
                createMultisigAccountTransactionMock(),
            ]);
            const expectedResult = false;

            // Act & Assert:
            runIsHarvestingServiceTransactionTest(transaction, expectedResult);
        });

        it('returns false when transaction is not an aggregate', () => {
            // Arrange:
            const transaction = createTransferTransactionMock();
            const expectedResult = false;

            // Act & Assert:
            runIsHarvestingServiceTransactionTest(transaction, expectedResult);
        });
    });

    describe('isTransactionAwaitingSignatureByAccount', () => {
        const runIsTransactionAwaitingSignatureByAccountTest = (transaction, expectedResult) => {
            // Act:
            const result = isTransactionAwaitingSignatureByAccount(transaction, currentAccount);

            // Assert:
            expect(result).toBe(expectedResult);
        };

        it('returns true when transaction does not contain current account public key', () => {
            // Arrange:
            const transaction = {
                type: AGGREGATE_BONDED_TRANSACTION_TYPE,
                signerPublicKey: 'another-public-key',
                cosignatures: [],
            };
            const expectedResult = true;

            // Act & Assert:
            runIsTransactionAwaitingSignatureByAccountTest(transaction, expectedResult);
        });

        it('returns false when transaction signed by account public key', () => {
            // Arrange:
            const transaction = {
                type: AGGREGATE_BONDED_TRANSACTION_TYPE,
                signerPublicKey: currentAccount.publicKey,
                cosignatures: [],
            };
            const expectedResult = false;

            // Act & Assert:
            runIsTransactionAwaitingSignatureByAccountTest(transaction, expectedResult);
        });

        it('returns false when transaction cosigned by account public key', () => {
            // Arrange:
            const transaction = {
                type: AGGREGATE_BONDED_TRANSACTION_TYPE,
                signerPublicKey: 'another-public-key',
                cosignatures: [{ signerPublicKey: currentAccount.publicKey }],
            };
            const expectedResult = false;

            // Act & Assert:
            runIsTransactionAwaitingSignatureByAccountTest(transaction, expectedResult);
        });
    });

    describe('transactionToPayload', () => {
        it('returns the transaction payload', () => {
            // Arrange:
            const transaction = walletTransactions[0];
            const expectedResult = payloads[0].payload;

            // Act:
            const result = transactionToPayload(transaction, networkProperties);

            // Assert:
            expect(result).toBe(expectedResult);
        });
    });

    describe('isOutgoingTransaction', () => {
        it('returns true when signerAddress matches current account address', () => {
            // Arrange:
            const transaction = { signerAddress: currentAccount.address };
            const expectedResult = true;

            // Act:
            const result = isOutgoingTransaction(transaction, currentAccount);

            // Assert:
            expect(result).toBe(expectedResult);
        });

        it('returns false when signerAddress does not match current account address', () => {
            // Arrange:
            const transaction = { signerAddress: 'another-address' };
            const expectedResult = false;

            // Act:
            const result = isOutgoingTransaction(transaction, currentAccount);

            // Assert:
            expect(result).toBe(expectedResult);
        });
    });

    describe('isIncomingTransaction', () => {
        it('returns true when recipientAddress matches current account address', () => {
            // Arrange:
            const transaction = { recipientAddress: currentAccount.address };
            const expectedResult = true;

            // Act:
            const result = isIncomingTransaction(transaction, currentAccount);

            // Assert:
            expect(result).toBe(expectedResult);
        });

        it('returns false when recipientAddress does not match current account address', () => {
            // Arrange:
            const transaction = { recipientAddress: 'another-address' };
            const expectedResult = false;

            // Act:
            const result = isIncomingTransaction(transaction, currentAccount);

            // Assert:
            expect(result).toBe(expectedResult);
        });
    });

    describe('encodePlainMessage', () => {
        it('returns the encoded message', () => {
            // Arrange:
            const message = 'hello';
            const expectedResult = '0068656c6c6f';

            // Act:
            const result = encodePlainMessage(message);

            // Assert:
            expect(result).toBe(expectedResult);
        });
    });

    describe('decodePlainMessage', () => {
        it('returns the decoded message', () => {
            // Arrange:
            const message = '0068656c6c6f';
            const expectedResult = 'hello';

            // Act:
            const result = decodePlainMessage(message);

            // Assert:
            expect(result).toBe(expectedResult);
        });
    });

    describe('encodeDelegatedHarvestingMessage', () => {
        it('returns message with delegation marker and correct size', () => {
            // Arrange:
            const currentAccount = walletStorageAccounts.testnet[0];
            const remoteAccount = walletStorageAccounts.testnet[1];
            const vrfAccount = walletStorageAccounts.testnet[2];
            const nodeAccount = walletStorageAccounts.testnet[3];
            const expectedStringLength = 264;
            const expectedDelegationMarker = 'fe2a8061577301e2';

            // Act:
            const result = encodeDelegatedHarvestingMessage(
                currentAccount.privateKey,
                nodeAccount.publicKey,
                remoteAccount.privateKey,
                vrfAccount.privateKey
            );

            // Assert:
            expect(result.length).toBe(expectedStringLength);
            expect(result).toContain(expectedDelegationMarker);
        });
    });

    describe('encryptMessage', () => {
        it('returns the encrypted message which can be decrypted', () => {
            // Arrange:
            const initialMessage = 'hello';
            const privateKey = walletStorageAccounts.testnet[0].privateKey;
            const recipientPublicKey = walletStorageAccounts.testnet[1].publicKey;
            const expectedEncryptedMessageLength = 134;

            // Act:
            const encryptedMessage = encryptMessage(initialMessage, recipientPublicKey, privateKey);
            const decryptedMessage = decryptMessage(encryptedMessage, recipientPublicKey, privateKey);

            // Assert:
            expect(decryptedMessage).toBe(initialMessage);
            expect(encryptedMessage.length).toBe(expectedEncryptedMessageLength);
        });
    });

    describe('decryptMessage', () => {
        it('returns the decrypted message', () => {
            // Arrange:
            const message =
                '01413938394435433444434445383237343344313644384332443537383033443235383443363738394434423232323332394445424435464439424238353034354531';
            const privateKey = walletStorageAccounts.testnet[1].privateKey;
            const senderPublicKey = walletStorageAccounts.testnet[0].publicKey;
            const expectedResult = 'hello';

            // Act:
            const result = decryptMessage(message, senderPublicKey, privateKey);

            // Assert:
            expect(result).toBe(expectedResult);
        });
    });

    describe('removeBlockedTransactions', () => {
        it('returns the transactions without blocked signers', () => {
            // Arrange:
            const transactions = [
                { signerAddress: walletStorageAccounts.testnet[0].address },
                { signerAddress: walletStorageAccounts.testnet[1].address },
                { signerAddress: walletStorageAccounts.testnet[2].address },
            ];
            const blacklist = [
                { address: walletStorageAccounts.testnet[0].address },
                { address: walletStorageAccounts.testnet[2].address },
            ];
            const expectedResult = [{ signerAddress: walletStorageAccounts.testnet[1].address }];

            // Act:
            const result = removeBlockedTransactions(transactions, blacklist);

            // Assert:
            expect(result).toStrictEqual(expectedResult);
        });
    });

    describe('removeAllowedTransactions', () => {
        it('returns the transactions with only blocked signers', () => {
            // Arrange:
            const transactions = [
                { signerAddress: walletStorageAccounts.testnet[0].address },
                { signerAddress: walletStorageAccounts.testnet[1].address },
                { signerAddress: walletStorageAccounts.testnet[2].address },
            ];
            const blacklist = [
                { address: walletStorageAccounts.testnet[0].address },
                { address: walletStorageAccounts.testnet[2].address },
            ];
            const expectedResult = [
                { signerAddress: walletStorageAccounts.testnet[0].address },
                { signerAddress: walletStorageAccounts.testnet[2].address },
            ];

            // Act:
            const result = removeAllowedTransactions(transactions, blacklist);

            // Assert:
            expect(result).toStrictEqual(expectedResult);
        });
    });

    describe('signTransaction', () => {
        it('returns the signed transaction', () => {
            // Arrange:
            const transaction = walletTransactions[0];
            const privateKey = walletStorageAccounts.testnet[0].privateKey;
            const expectedResult = {
                hash: 'ABAFE8D420F27E5A585F56FCFD8D6EF9A59880048A9231DCEDAFD4C7668AAEBC',
                dto: {
                    payload:
                        '9800000000000000A85FB6F06D6C7ADAE83E4B7CFAB3C854BC70CA377E84C7C0F241CFD269C1EF0F59C4A40C94AEE2B1F3294AC06D5EF00B0A0E2A80A4E597DDB12106D19CA0E900F9214C919AB21E14385107FE17E1BE6B95D8598C8BD1413B951D65D76ABA1A6C0000000001984E41603B000000000000856F97F603000000805101000000000020E8450346A9269B0006746573742D2D',
                },
            };

            // Act:
            const result = signTransaction(networkProperties, transaction, privateKey);

            // Assert:
            expect(result).toStrictEqual(expectedResult);
        });
    });

    describe('cosignTransaction', () => {
        it('returns the signed transaction', () => {
            // Arrange:
            const transaction = walletTransactions[0];
            const currentAccount = walletStorageAccounts.testnet[0];
            const privateKey = currentAccount.privateKey;
            const expectedResult = {
                hash: '038702AB2048D560E5379A55C89DB48E08841FF1CB84DC2C51FFBC5D79ECBC2A',
                dto: {
                    signature:
                        '4F756FD677032110A73F8E02E165F52AF2F5D8E4F208668C6A215D561C7EEF8F02CC703BBFA6C3F9454665E4BB0F3AA5FD8AE8958DD034CFB9EF6F9732B2FE0A',
                    signerPublicKey: currentAccount.publicKey,
                    parentHash: transaction.hash,
                    version: '0',
                },
            };

            // Act:
            const result = cosignTransaction(networkProperties, transaction, privateKey);

            // Assert:
            expect(result).toStrictEqual(expectedResult);
        });
    });
});
