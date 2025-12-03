import { MessageType, TransactionBundleType, TransactionType } from '../../src/constants';
import { TransferModule } from '../../src/modules/TransferModule';
import {
	createDeadline,
	createTransactionFee,
	encodePlainMessage,
	namespaceIdFromName
} from '../../src/utils';
import { networkProperties } from '../__fixtures__/local/network';
import { walletTransactions } from '../__fixtures__/local/transactions';
import { currentAccount, walletStorageAccounts } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { ControllerError, TransactionBundle } from 'wallet-common-core';

const recipientAccount = walletStorageAccounts.testnet[1];
const otherAccount = walletStorageAccounts.testnet[2];
const FIXED_NOW_MS = 1_700_000_000_000;

const createMosaics = () => ([
	{
		id: '72C0212E67A08BCE',
		divisibility: 6,
		amount: '1000000'
	}
]);

const createFee = amount => ({
	token: {
		id: '72C0212E67A08BCE',
		amount,
		divisibility: 6
	}
});

describe('TransferModule', () => {
	let transferModule;
	let api;
	let walletController;

	beforeEach(() => {
		api = {
			account: {
				fetchAccountInfo: jest.fn()
			},
			namespace: {
				resolveAddress: jest.fn()
			}
		};

		walletController = {
			currentAccount,
			networkProperties,
			networkIdentifier: networkProperties.networkIdentifier,
			encryptMessage: jest.fn(async (text, key) => `ENC(${text})-with-${key}`),
			decryptMessage: jest.fn(async (payload, key) => `DEC(${payload})-with-${key}`)
		};

		transferModule = new TransferModule();
		transferModule.init({ walletController, api });
		jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
		jest.clearAllMocks();
	});

	it('has correct static name', () => {
		// Assert:
		expect(TransferModule.name).toBe('transfer');
	});

	describe('createTransaction()', () => {
		const runCreateTransactionTest = async (config, expected) => {
			// Arrange:
			const { options, mock } = config;

			if (mock?.resolvedAddress !== undefined) 
				api.namespace.resolveAddress.mockResolvedValue(mock.resolvedAddress);
            
			if (mock?.recipientPublicKey) 
				api.account.fetchAccountInfo.mockResolvedValue({ publicKey: mock.recipientPublicKey });
            

			// Act:
			let error;
			let result;
			try {
				result = await transferModule.createTransaction(options, mock?.password);
			} catch (e) {
				error = e;
			}

			// Assert:
			if (!expected.error && error) {
				throw error;
			} else if (expected.error) {
				expect(error).toBeDefined();
				expect(error).toStrictEqual(expected.error);
			} else if (expected.result) {
				expect(result.toJSON()).toStrictEqual(expected.result.toJSON());
			}

			if (expected.shouldResolveAddress) {
				expect(api.namespace.resolveAddress).toHaveBeenCalledTimes(1);
				expect(api.namespace.resolveAddress).toHaveBeenCalledWith(
					networkProperties,
					expected.namespaceIdToResolve
				);
			} else {
				expect(api.namespace.resolveAddress).not.toHaveBeenCalled();
			}

			if (expected.shouldFetchRecipientInfo) {
				expect(api.account.fetchAccountInfo).toHaveBeenCalledTimes(1);
				expect(api.account.fetchAccountInfo).toHaveBeenCalledWith(
					networkProperties,
					recipientAccount.address
				);
			} else {
				expect(api.account.fetchAccountInfo).not.toHaveBeenCalled();
			}
		};

		it('creates simple transfer transaction to address with plain message', async () => {
			// Arrange:
			const messageText = 'Hello Symbol';
			const fee = createFee('1');
			const options = {
				recipientAddress: recipientAccount.address,
				mosaics: createMosaics(),
				messageText,
				isMessageEncrypted: false,
				fee
			};
			const senderPublicKey = currentAccount.publicKey;
			const senderAddress = currentAccount.address;
			const expectedTransfer = {
				type: TransactionType.TRANSFER,
				signerPublicKey: senderPublicKey,
				signerAddress: senderAddress,
				recipientAddress: recipientAccount.address,
				mosaics: createMosaics(),
				deadline: createDeadline(2, networkProperties.epochAdjustment),
				message: {
					text: messageText,
					payload: encodePlainMessage(messageText),
					type: MessageType.PlainText
				},
				fee
			};
			const expectedResult = new TransactionBundle([expectedTransfer], { type: TransactionBundleType.DEFAULT });

			// Act & Assert:
			await runCreateTransactionTest(
				{ options },
				{
					result: expectedResult,
					shouldFetchRecipientInfo: false,
					shouldResolveAddress: false
				}
			);
		});

		it('creates simple transfer transaction to address without message', async () => {
			// Arrange:
			const fee = createFee('0.5');
			const options = {
				recipientAddress: recipientAccount.address,
				mosaics: createMosaics(),
				isMessageEncrypted: false,
				fee
			};
			const senderPublicKey = currentAccount.publicKey;
			const senderAddress = currentAccount.address;
			const expectedTransfer = {
				type: TransactionType.TRANSFER,
				signerPublicKey: senderPublicKey,
				signerAddress: senderAddress,
				recipientAddress: recipientAccount.address,
				mosaics: createMosaics(),
				deadline: createDeadline(2, networkProperties.epochAdjustment),
				fee
			};
			const expectedResult = new TransactionBundle([expectedTransfer], { type: TransactionBundleType.DEFAULT });

			// Act & Assert:
			await runCreateTransactionTest(
				{ options },
				{
					result: expectedResult,
					shouldFetchRecipientInfo: false,
					shouldResolveAddress: false
				}
			);
		});

		it('creates transfer transaction to alias with plain message', async () => {
			// Arrange:
			const aliasName = 'pppplllll.subnamespace';
			const namespaceIdToResolve = namespaceIdFromName(aliasName.toLowerCase());
			const fee = createFee('1.2');
			const options = {
				recipientAddress: aliasName,
				mosaics: createMosaics(),
				messageText: 'Alias transfer',
				isMessageEncrypted: false,
				fee
			};
			const senderPublicKey = currentAccount.publicKey;
			const senderAddress = currentAccount.address;
			const resolvedAddress = recipientAccount.address;
			const expectedTransfer = {
				type: TransactionType.TRANSFER,
				signerPublicKey: senderPublicKey,
				signerAddress: senderAddress,
				recipientAddress: resolvedAddress,
				mosaics: createMosaics(),
				deadline: createDeadline(2, networkProperties.epochAdjustment),
				message: {
					text: 'Alias transfer',
					payload: encodePlainMessage('Alias transfer'),
					type: MessageType.PlainText
				},
				fee
			};
			const expectedResult = new TransactionBundle([expectedTransfer], { type: TransactionBundleType.DEFAULT });

			// Act & Assert:
			await runCreateTransactionTest(
				{
					options,
					mock: {
						resolvedAddress
					}
				},
				{
					result: expectedResult,
					shouldFetchRecipientInfo: false,
					shouldResolveAddress: true,
					namespaceIdToResolve
				}
			);
		});

		it('creates transfer transaction to address with encrypted message', async () => {
			// Arrange:
			const messageText = 'Secret';
			const fee = createFee('3');
			const options = {
				recipientAddress: recipientAccount.address,
				mosaics: createMosaics(),
				messageText,
				isMessageEncrypted: true,
				fee
			};
			const senderPublicKey = currentAccount.publicKey;
			const senderAddress = currentAccount.address;
			const expectedTransfer = {
				type: TransactionType.TRANSFER,
				signerPublicKey: senderPublicKey,
				signerAddress: senderAddress,
				recipientAddress: recipientAccount.address,
				mosaics: createMosaics(),
				deadline: createDeadline(2, networkProperties.epochAdjustment),
				message: {
					text: messageText,
					payload: `ENC(${messageText})-with-${recipientAccount.publicKey}`,
					type: MessageType.EncryptedText
				},
				fee
			};
			const expectedResult = new TransactionBundle([expectedTransfer], { type: TransactionBundleType.DEFAULT });

			// Act & Assert:
			await runCreateTransactionTest(
				{
					options,
					mock: {
						recipientPublicKey: recipientAccount.publicKey
					}
				},
				{
					result: expectedResult,
					shouldFetchRecipientInfo: true,
					shouldResolveAddress: false
				}
			);
		});

		it('creates multisig transfer transaction (aggregate bonded + hash lock) when sender differs from current account', async () => {
			// Arrange:
			const fee = createFee('2');
			const options = {
				senderPublicKey: otherAccount.publicKey,
				recipientAddress: recipientAccount.address,
				mosaics: createMosaics(),
				isMessageEncrypted: false,
				fee
			};
			const senderPublicKey = otherAccount.publicKey;
			const senderAddress = otherAccount.address;
			const innerTransfer = {
				type: TransactionType.TRANSFER,
				signerPublicKey: senderPublicKey,
				signerAddress: senderAddress,
				recipientAddress: recipientAccount.address,
				mosaics: createMosaics(),
				deadline: createDeadline(2, networkProperties.epochAdjustment)
			};
			const hashLock = {
				type: TransactionType.HASH_LOCK,
				signerPublicKey: currentAccount.publicKey,
				mosaic: {
					id: networkProperties.networkCurrency.mosaicId,
					amount: '10',
					divisibility: networkProperties.networkCurrency.divisibility
				},
				lockedAmount: '10',
				duration: 1000,
				fee,
				deadline: createDeadline(2, networkProperties.epochAdjustment),
				aggregateHash: '0000000000000000000000000000000000000000000000000000000000000000'
			};
			const aggregateBonded = {
				type: TransactionType.AGGREGATE_BONDED,
				innerTransactions: [innerTransfer],
				signerPublicKey: currentAccount.publicKey,
				signerAddress: currentAccount.address,
				fee,
				deadline: createDeadline(48, networkProperties.epochAdjustment)
			};
			const expectedResult = new TransactionBundle(
				[hashLock, aggregateBonded],
				{ type: TransactionBundleType.MULTISIG_TRANSFER }
			);

			// Act & Assert:
			await runCreateTransactionTest(
				{ options },
				{
					result: expectedResult,
					shouldFetchRecipientInfo: false,
					shouldResolveAddress: false
				}
			);
		});

		it('throws error when alias cannot be resolved', async () => {
			// Arrange:
			const aliasName = 'nonexistent.alias';
			const namespaceIdToResolve = namespaceIdFromName(aliasName.toLowerCase());
			const options = {
				recipientAddress: aliasName,
				mosaics: createMosaics(),
				isMessageEncrypted: false,
				fee: createFee('0.1')
			};
			const expectedError = new ControllerError(
				'error_transfer_unknown_recipient',
				`Failed to create transfer transaction. Recipient address not found for provided alias "${aliasName}"`
			);

			// Act & Assert:
			await runCreateTransactionTest(
				{
					options,
					mock: {
						resolvedAddress: null
					}
				},
				{
					error: expectedError,
					shouldFetchRecipientInfo: false,
					shouldResolveAddress: true,
					namespaceIdToResolve
				}
			);
		});

		it('creates transfer with default fee when fee not provided', async () => {
			// Arrange:
			const options = {
				recipientAddress: recipientAccount.address,
				mosaics: createMosaics(),
				messageText: 'No fee provided',
				isMessageEncrypted: false
			};
			const senderPublicKey = currentAccount.publicKey;
			const senderAddress = currentAccount.address;
			const defaultFee = createTransactionFee(networkProperties, '0');
			const expectedTransfer = {
				type: TransactionType.TRANSFER,
				signerPublicKey: senderPublicKey,
				signerAddress: senderAddress,
				recipientAddress: recipientAccount.address,
				mosaics: createMosaics(),
				deadline: createDeadline(2, networkProperties.epochAdjustment),
				message: {
					text: 'No fee provided',
					payload: encodePlainMessage('No fee provided'),
					type: MessageType.PlainText
				},
				fee: defaultFee
			};
			const expectedResult = new TransactionBundle([expectedTransfer], { type: TransactionBundleType.DEFAULT });

			// Act & Assert:
			await runCreateTransactionTest(
				{ options },
				{
					result: expectedResult,
					shouldFetchRecipientInfo: false,
					shouldResolveAddress: false
				}
			);
		});
	});

	describe('calculateTransactionFees()', () => {
		it('returns fee tiers array for given transaction bundle', async () => {
			// Arrange:
			const transferBundle = new TransactionBundle([
				walletTransactions[0],
				walletTransactions[1]
			]);
			const expectedResult = [
				{
					fast: {
						token: {
							amount: '0.0304',
							divisibility: 6,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					},
					medium: {
						token: {
							amount: '0.02508',
							divisibility: 6,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					},
					slow: {
						token: {
							amount: '0.02052',
							divisibility: 6,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					}
				},
				{
					fast: {
						token: {
							amount: '0.1744',
							divisibility: 6,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					},
					medium: {
						token: {
							amount: '0.14388',
							divisibility: 6,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					},
					slow: {
						token: {
							amount: '0.11772',
							divisibility: 6,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					}
				}
			];

			// Act:
			const result = await transferModule.calculateTransactionFees(transferBundle);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		});
	});

	describe('getDecryptedMessageText()', () => {
		const createIncomingEncryptedTransfer = (overrides = {}) => ({
			type: TransactionType.TRANSFER,
			signerPublicKey: walletStorageAccounts.testnet[2].publicKey, // sender
			signerAddress: walletStorageAccounts.testnet[2].address,
			recipientAddress: currentAccount.address, 
			message: {
				type: MessageType.EncryptedText,
				text: undefined,
				payload: 'ENCRYPTED_PAYLOAD_INCOMING'
			},
			mosaics: [],
			deadline: createDeadline(2, networkProperties.epochAdjustment),
			...overrides
		});

		const createOutgoingEncryptedTransfer = (overrides = {}) => ({
			type: TransactionType.TRANSFER,
			signerPublicKey: currentAccount.publicKey,
			signerAddress: currentAccount.address,
			recipientAddress: recipientAccount.address,
			message: {
				type: MessageType.EncryptedText,
				text: undefined,
				payload: 'ENCRYPTED_PAYLOAD_OUTGOING'
			},
			mosaics: [],
			deadline: createDeadline(2, networkProperties.epochAdjustment),
			...overrides
		});

		const createIncomingPlainTransfer = (overrides = {}) => ({
			type: TransactionType.TRANSFER,
			signerPublicKey: otherAccount.publicKey,
			signerAddress: otherAccount.address,
			recipientAddress: currentAccount.address,
			message: {
				type: MessageType.PlainText,
				text: 'Hello Plain',
				payload: encodePlainMessage('Hello Plain')
			},
			mosaics: [],
			deadline: createDeadline(2, networkProperties.epochAdjustment),
			...overrides
		});

		const runGetDecryptedMessageTextTest = async (config, expected) => {
			// Arrange:
			const { transaction, mock, password } = config;

			if (mock?.recipientPublicKey) 
				api.account.fetchAccountInfo.mockResolvedValue({ publicKey: mock.recipientPublicKey });
            

			// Act:
			let error;
			let result;
			try {
				result = await transferModule.getDecryptedMessageText(transaction, password);
			} catch (e) {
				error = e;
			}

			// Assert:
			if (!expected.error && error) {
				throw error;
			} else if (expected.error) {
				expect(error).toBeDefined();
				expect(error).toStrictEqual(expected.error);
			} else {
				expect(result).toStrictEqual(expected.result);
			}

			if (expected.shouldFetchRecipientInfo) {
				expect(api.account.fetchAccountInfo).toHaveBeenCalledTimes(1);
				expect(api.account.fetchAccountInfo).toHaveBeenCalledWith(
					networkProperties,
					transaction.recipientAddress
				);
			} else {
				expect(api.account.fetchAccountInfo).not.toHaveBeenCalled();
			}

			if (expected.decryptCalledWith) {
				expect(walletController.decryptMessage).toHaveBeenCalledTimes(1);
				expect(walletController.decryptMessage).toHaveBeenCalledWith(
					expected.decryptCalledWith.payload,
					expected.decryptCalledWith.publicKey,
					expected.decryptCalledWith.password
				);
			} else {
				expect(walletController.decryptMessage).not.toHaveBeenCalled();
			}
		};

		it('decrypts encrypted incoming transfer using signer public key', async () => {
			// Arrange:
			const password = 'p@ss';
			const transaction = createIncomingEncryptedTransfer();
			const expectedResult = `DEC(${transaction.message.payload})-with-${transaction.signerPublicKey}`;

			// Act & Assert:
			await runGetDecryptedMessageTextTest(
				{
					transaction,
					password
				},
				{
					result: expectedResult,
					shouldFetchRecipientInfo: false,
					decryptCalledWith: {
						payload: transaction.message.payload,
						publicKey: transaction.signerPublicKey,
						password
					}
				}
			);
		});

		it('decrypts encrypted outgoing transfer using recipient public key', async () => {
			// Arrange:
			const password = 'secret';
			const transaction = createOutgoingEncryptedTransfer();
			const expectedResult = `DEC(${transaction.message.payload})-with-${recipientAccount.publicKey}`;

			// Act & Assert:
			await runGetDecryptedMessageTextTest(
				{
					transaction,
					password,
					mock: {
						recipientPublicKey: recipientAccount.publicKey
					}
				},
				{
					result: expectedResult,
					shouldFetchRecipientInfo: true,
					decryptCalledWith: {
						payload: transaction.message.payload,
						publicKey: recipientAccount.publicKey,
						password
					}
				}
			);
		});

		it('attempts to decrypt plain incoming message (current behavior)', async () => {
			// Arrange:
			const password = 'ignored';
			const transaction = createIncomingPlainTransfer();
			const expectedResult = `DEC(${transaction.message.payload})-with-${transaction.signerPublicKey}`;

			// Act & Assert:
			await runGetDecryptedMessageTextTest(
				{
					transaction,
					password
				},
				{
					result: expectedResult,
					shouldFetchRecipientInfo: false,
					decryptCalledWith: {
						payload: transaction.message.payload,
						publicKey: transaction.signerPublicKey,
						password
					}
				}
			);
		});

		it('throws when transaction type is not transfer', async () => {
			// Arrange:
			const transaction = {
				type: TransactionType.AGGREGATE_BONDED,
				message: { type: MessageType.EncryptedText, payload: 'x' },
				recipientAddress: recipientAccount.address,
				signerPublicKey: currentAccount.publicKey
			};
			const expectedError = new ControllerError(
				'error_failed_decrypt_message_invalid_transaction_type',
				// eslint-disable-next-line max-len
				`Failed to decrypt message. Transaction type "${transaction.type}" is not supported. Expected type "${TransactionType.TRANSFER}"`
			);

			// Act & Assert:
			await runGetDecryptedMessageTextTest(
				{ transaction },
				{
					error: expectedError,
					shouldFetchRecipientInfo: false
				}
			);
		});

		it('throws when transaction is not related to current account', async () => {
			// Arrange:
			const transaction = {
				type: TransactionType.TRANSFER,
				signerPublicKey: otherAccount.publicKey,
				signerAddress: otherAccount.address,
				recipientAddress: walletStorageAccounts.testnet[3].address,
				message: { type: MessageType.EncryptedText, payload: 'ENCRYPTED' },
				mosaics: [],
				deadline: createDeadline(2, networkProperties.epochAdjustment)
			};
			const expectedError = new ControllerError(
				'error_failed_decrypt_message_not_related',
				'Failed to decrypt message. Transaction is not related to current account'
			);

			// Act & Assert:
			await runGetDecryptedMessageTextTest(
				{ transaction },
				{
					error: expectedError,
					shouldFetchRecipientInfo: false
				}
			);
		});
	});
});
