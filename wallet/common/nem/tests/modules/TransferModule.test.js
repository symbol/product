import {
	MULTISIG_TRANSACTION_DEADLINE_HOURS,
	MessageType,
	NativeMessageType,
	SINGLE_TRANSACTION_DEADLINE_HOURS,
	TransactionBundleType,
	TransactionType
} from '../../src/constants';
import { TransferModule } from '../../src/modules/TransferModule';
import { createDeadline, createTransactionFee, encodePlainMessage } from '../../src/utils';
import { networkProperties } from '../__fixtures__/local/network';
import { incomingTransfer, outgoingTransfer } from '../__fixtures__/local/transactions';
import { accounts, currentAccount } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { ControllerError, TransactionBundle } from 'wallet-common-core';

// Constants

const { bob, carol } = accounts;
const RECIPIENT_ADDRESS = bob.address;
const MULTISIG_PUBLIC_KEY = carol.publicKey;
const INVALID_ADDRESS = 'NOT-A-NEM-ADDRESS';

const singleDeadline = createDeadline(networkProperties.networkTime, SINGLE_TRANSACTION_DEADLINE_HOURS);
const multisigDeadline = createDeadline(networkProperties.networkTime, MULTISIG_TRANSACTION_DEADLINE_HOURS);

// Fixtures

const nativeMosaics = (amount = '10') => [{ id: 'nem.xem', name: 'XEM', amount, divisibility: 6 }];
const createFee = amount => createTransactionFee(networkProperties, amount);

const plainMessage = text => ({
	type: MessageType.PLAIN,
	text,
	payload: encodePlainMessage(text),
	native: { type: NativeMessageType.PlainText }
});

const encryptedMessage = (text, payload) => ({
	type: MessageType.ENCRYPTED,
	text,
	payload,
	native: { type: NativeMessageType.EncryptedText }
});

// NEM fees are deterministic, so all tiers (fast, medium, slow) carry the same fee.
const expectedFeeTiers = amount => {
	const tier = createFee(amount);

	return { fast: tier, medium: tier, slow: tier };
};

describe('modules/TransferModule', () => {
	let transferModule;
	let api;
	let walletController;

	beforeEach(() => {
		api = {
			account: {
				fetchAccountInfo: jest.fn()
			}
		};
		walletController = {
			currentAccount,
			networkProperties,
			networkIdentifier: networkProperties.networkIdentifier,
			encryptMessage: jest.fn(async (text, recipientPublicKey) => `ENC(${text})-with-${recipientPublicKey}`),
			decryptMessage: jest.fn(async (payload, counterpartyPublicKey) => `DEC(${payload})-with-${counterpartyPublicKey}`)
		};

		transferModule = new TransferModule();
		transferModule.init({ walletController, api });
	});

	it('exposes the transfer static name', () => {
		// Assert:
		expect(TransferModule.name).toBe('transfer');
	});

	describe('createTransaction', () => {
		const runCreateTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				if (config.mock?.recipientPublicKey !== undefined)
					api.account.fetchAccountInfo.mockResolvedValue({ publicKey: config.mock.recipientPublicKey });

				// Act:
				let result;
				let error;
				try {
					result = await transferModule.createTransaction(config.options, config.mock?.password);
				} catch (caught) {
					error = caught;
				}

				// Assert:
				if (expected.error) {
					expect(error).toStrictEqual(expected.error);
				} else {
					if (error)
						throw error;

					expect(result.toJSON()).toStrictEqual(expected.bundle.toJSON());
				}

				if (expected.shouldFetchRecipientInfo) {
					expect(api.account.fetchAccountInfo).toHaveBeenCalledTimes(1);
					expect(api.account.fetchAccountInfo).toHaveBeenCalledWith(networkProperties, config.options.recipientAddress);
				} else {
					expect(api.account.fetchAccountInfo).not.toHaveBeenCalled();
				}
			});
		};

		const createTransactionTests = [
			{
				description: 'builds a transfer with a plain message',
				config: {
					options: {
						recipientAddress: RECIPIENT_ADDRESS,
						mosaics: nativeMosaics('10'),
						message: 'Good luck!',
						isEncrypted: false,
						fee: createFee('1')
					}
				},
				expected: {
					bundle: new TransactionBundle([{
						type: TransactionType.TRANSFER,
						signerPublicKey: currentAccount.publicKey,
						recipientAddress: RECIPIENT_ADDRESS,
						mosaics: nativeMosaics('10'),
						message: plainMessage('Good luck!'),
						fee: createFee('1'),
						deadline: singleDeadline
					}], { type: TransactionBundleType.DEFAULT }),
					shouldFetchRecipientInfo: false
				}
			},
			{
				description: 'builds a transfer without a message',
				config: {
					options: {
						recipientAddress: RECIPIENT_ADDRESS,
						mosaics: nativeMosaics('5'),
						fee: createFee('0.5')
					}
				},
				expected: {
					bundle: new TransactionBundle([{
						type: TransactionType.TRANSFER,
						signerPublicKey: currentAccount.publicKey,
						recipientAddress: RECIPIENT_ADDRESS,
						mosaics: nativeMosaics('5'),
						message: null,
						fee: createFee('0.5'),
						deadline: singleDeadline
					}], { type: TransactionBundleType.DEFAULT }),
					shouldFetchRecipientInfo: false
				}
			},
			{
				description: 'defaults the fee to zero when none is provided',
				config: {
					options: {
						recipientAddress: RECIPIENT_ADDRESS,
						mosaics: nativeMosaics('10')
					}
				},
				expected: {
					bundle: new TransactionBundle([{
						type: TransactionType.TRANSFER,
						signerPublicKey: currentAccount.publicKey,
						recipientAddress: RECIPIENT_ADDRESS,
						mosaics: nativeMosaics('10'),
						message: null,
						fee: createFee('0'),
						deadline: singleDeadline
					}], { type: TransactionBundleType.DEFAULT }),
					shouldFetchRecipientInfo: false
				}
			},
			{
				description: 'resolves the recipient public key and encrypts the message',
				config: {
					options: {
						recipientAddress: RECIPIENT_ADDRESS,
						mosaics: nativeMosaics('10'),
						message: 'Secret',
						isEncrypted: true,
						fee: createFee('3')
					},
					mock: { recipientPublicKey: bob.publicKey, password: 'p@ss' }
				},
				expected: {
					bundle: new TransactionBundle([{
						type: TransactionType.TRANSFER,
						signerPublicKey: currentAccount.publicKey,
						recipientAddress: RECIPIENT_ADDRESS,
						mosaics: nativeMosaics('10'),
						message: encryptedMessage('Secret', `ENC(Secret)-with-${bob.publicKey}`),
						fee: createFee('3'),
						deadline: singleDeadline
					}], { type: TransactionBundleType.DEFAULT }),
					shouldFetchRecipientInfo: true
				}
			},
			{
				description: 'wraps the transfer in a multisig transaction when the sender is another account',
				config: {
					options: {
						senderPublicKey: MULTISIG_PUBLIC_KEY,
						recipientAddress: RECIPIENT_ADDRESS,
						mosaics: nativeMosaics('10')
					}
				},
				expected: {
					bundle: new TransactionBundle([{
						type: TransactionType.MULTISIG,
						signerPublicKey: currentAccount.publicKey,
						innerTransaction: {
							type: TransactionType.TRANSFER,
							signerPublicKey: MULTISIG_PUBLIC_KEY,
							recipientAddress: RECIPIENT_ADDRESS,
							mosaics: nativeMosaics('10'),
							message: null,
							fee: createFee('0.05'),
							deadline: singleDeadline
						},
						fee: createFee('0.15'),
						deadline: multisigDeadline
					}], { type: TransactionBundleType.MULTISIG_TRANSFER }),
					shouldFetchRecipientInfo: false
				}
			},
			{
				description: 'throws when the recipient address is invalid',
				config: {
					options: {
						recipientAddress: INVALID_ADDRESS,
						mosaics: nativeMosaics('10'),
						fee: createFee('0.1')
					}
				},
				expected: {
					error: new ControllerError(
						'error_transfer_invalid_recipient',
						`Invalid NEM recipient address: "${INVALID_ADDRESS}"`
					),
					shouldFetchRecipientInfo: false
				}
			},
			{
				description: 'throws when an encrypted message has no resolvable recipient public key',
				config: {
					options: {
						recipientAddress: RECIPIENT_ADDRESS,
						mosaics: nativeMosaics('10'),
						message: 'Secret',
						isEncrypted: true,
						fee: createFee('0.1')
					},
					mock: { recipientPublicKey: null, password: 'p@ss' }
				},
				expected: {
					error: new ControllerError(
						'error_transfer_encrypted_message_no_recipient_public_key',
						`Cannot encrypt message: recipient public key for "${RECIPIENT_ADDRESS}" is unknown`
					),
					shouldFetchRecipientInfo: true
				}
			}
		];

		createTransactionTests.forEach(test => runCreateTransactionTest(test.description, test.config, test.expected));
	});

	describe('calculateTransactionFees', () => {
		it('derives deterministic fee tiers from each transaction in the bundle', async () => {
			// Arrange: a 10 XEM transfer with a 10-byte message costs 0.1 XEM; a 5 XEM transfer costs 0.05 XEM.
			const transactionBundle = new TransactionBundle([outgoingTransfer, incomingTransfer]);
			const expectedFees = [expectedFeeTiers('0.1'), expectedFeeTiers('0.05')];

			// Act:
			const result = await transferModule.calculateTransactionFees(transactionBundle);

			// Assert:
			expect(result).toStrictEqual(expectedFees);
		});
	});

	describe('getDecryptedMessageText', () => {
		const incomingEncryptedTransfer = {
			type: TransactionType.TRANSFER,
			signerPublicKey: bob.publicKey,
			signerAddress: bob.address,
			recipientAddress: currentAccount.address,
			message: { type: MessageType.ENCRYPTED, text: null, payload: 'encryptedIncoming' }
		};

		const outgoingEncryptedTransfer = {
			type: TransactionType.TRANSFER,
			signerPublicKey: currentAccount.publicKey,
			signerAddress: currentAccount.address,
			recipientAddress: RECIPIENT_ADDRESS,
			message: { type: MessageType.ENCRYPTED, text: null, payload: 'encryptedOutgoing' }
		};

		const incomingPlainTransfer = {
			type: TransactionType.TRANSFER,
			signerPublicKey: bob.publicKey,
			signerAddress: bob.address,
			recipientAddress: currentAccount.address,
			message: { type: MessageType.PLAIN, text: 'Good luck!', payload: encodePlainMessage('Good luck!') }
		};

		const runGetDecryptedMessageTextTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				if (config.mock?.recipientPublicKey !== undefined)
					api.account.fetchAccountInfo.mockResolvedValue({ publicKey: config.mock.recipientPublicKey });

				// Act:
				let result;
				let error;
				try {
					result = await transferModule.getDecryptedMessageText(config.transaction, config.password);
				} catch (caught) {
					error = caught;
				}

				// Assert:
				if (expected.error) {
					expect(error).toStrictEqual(expected.error);
				} else {
					if (error)
						throw error;

					expect(result).toBe(expected.text);
				}

				if (expected.decryptCalledWith) {
					expect(walletController.decryptMessage).toHaveBeenCalledTimes(1);
					expect(walletController.decryptMessage).toHaveBeenCalledWith(
						expected.decryptCalledWith.payload,
						expected.decryptCalledWith.publicKey,
						config.password
					);
				} else {
					expect(walletController.decryptMessage).not.toHaveBeenCalled();
				}
			});
		};

		const getDecryptedMessageTextTests = [
			{
				description: 'returns the plain text directly for a non-encrypted message',
				config: { transaction: incomingPlainTransfer, password: 'ignored' },
				expected: { text: 'Good luck!' }
			},
			{
				description: 'decrypts an incoming message with the signer public key',
				config: { transaction: incomingEncryptedTransfer, password: 'p@ss' },
				expected: {
					text: `DEC(${incomingEncryptedTransfer.message.payload})-with-${bob.publicKey}`,
					decryptCalledWith: { payload: incomingEncryptedTransfer.message.payload, publicKey: bob.publicKey }
				}
			},
			{
				description: 'decrypts an outgoing message with the resolved recipient public key',
				config: { transaction: outgoingEncryptedTransfer, password: 'secret', mock: { recipientPublicKey: bob.publicKey } },
				expected: {
					text: `DEC(${outgoingEncryptedTransfer.message.payload})-with-${bob.publicKey}`,
					decryptCalledWith: { payload: outgoingEncryptedTransfer.message.payload, publicKey: bob.publicKey }
				}
			},
			{
				description: 'throws when the transaction is not a transfer',
				config: {
					transaction: {
						type: TransactionType.MULTISIG,
						message: { type: MessageType.ENCRYPTED, payload: 'x' },
						recipientAddress: RECIPIENT_ADDRESS,
						signerPublicKey: currentAccount.publicKey
					}
				},
				expected: {
					error: new ControllerError(
						'error_failed_decrypt_message_invalid_transaction_type',
						`Failed to decrypt message. Transaction type "${TransactionType.MULTISIG}" is not supported. `
						+ `Expected type "${TransactionType.TRANSFER}"`
					)
				}
			},
			{
				description: 'throws when the transaction is not related to the current account',
				config: {
					transaction: {
						type: TransactionType.TRANSFER,
						signerPublicKey: bob.publicKey,
						signerAddress: bob.address,
						recipientAddress: carol.address,
						message: { type: MessageType.ENCRYPTED, payload: 'encrypted' }
					}
				},
				expected: {
					error: new ControllerError(
						'error_failed_decrypt_message_not_related',
						'Failed to decrypt message. Transaction is not related to the current account'
					)
				}
			}
		];

		getDecryptedMessageTextTests.forEach(test => runGetDecryptedMessageTextTest(test.description, test.config, test.expected));
	});
});
