import { networkProperties as networkPropertiesFixture } from '../__fixtures__/local/network';
import { currentAccount as currentAccountFixture } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { ControllerError } from 'wallet-common-core';

// Mock utils before importing SUT
jest.unstable_mockModule('../../src/utils', () => {
	return {
		createDeadline: jest.fn(hours => `DL${hours}`),
		createFee: jest.fn(fee => `FEE:${fee}`),
		encodePlainMessage: jest.fn(text => `PLAIN:${text}`),
		isIncomingTransaction: jest.fn(() => false),
		isOutgoingTransaction: jest.fn(() => false),
		isSymbolAddress: jest.fn(() => true),
		namespaceIdFromName: jest.fn(name => `NAMESPACE(${name})`)
	};
});

const { TransferModule } = await import('../../src/modules/TransferModule');
const { MessageType, TransactionType } = await import('../../src/constants');
const utils = await import('../../src/utils');

describe('TransferModule', () => {
	let transferModule;
	let api;
	let walletController;

	const currentAccount = { ...currentAccountFixture };
	const networkProperties = {
		...networkPropertiesFixture,
		epochAdjustment: Number(networkPropertiesFixture.epochAdjustment)
	};

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
			encryptMessage: jest.fn(async (text, pubKey) => `ENC(${text})-for-${pubKey}`),
			decryptMessage: jest.fn(async (payload, pubKey) => `DEC(${payload})-with-${pubKey}`)
		};

		transferModule = new TransferModule();
		transferModule.init({ walletController, api });

		jest.clearAllMocks();
	});

	it('has correct static name', () => {
		// Assert:
		expect(TransferModule.name).toBe('transfer');
	});

	describe('createTransaction()', () => {
		it('creates a direct transfer with plain message when recipient is a symbol address', async () => {
			// Arrange:
			const recipientAddress = 'TAVALIDADDRESS...';
			const mosaics = [{ mosaicId: 'MOCK', amount: '1000' }];
			const messageText = 'hello world';
			const fee = 100;

			utils.isSymbolAddress.mockReturnValue(true);

			// Act:
			const tx = await transferModule.createTransaction({
				recipientAddressOrAlias: recipientAddress,
				mosaics,
				messageText,
				isMessageEncrypted: false,
				fee
			});

			// Assert:
			expect(utils.isSymbolAddress).toHaveBeenCalledWith(recipientAddress);
			expect(utils.encodePlainMessage).toHaveBeenCalledWith(messageText);
			expect(utils.createDeadline).toHaveBeenCalledWith(2, networkProperties.epochAdjustment);
			expect(utils.createFee).toHaveBeenCalledWith(fee, networkProperties);
			expect(tx).toEqual({
				type: TransactionType.TRANSFER,
				signerPublicKey: currentAccount.publicKey,
				recipientAddress,
				mosaics,
				deadline: 'DL2',
				message: {
					text: messageText,
					payload: `PLAIN:${messageText}`,
					type: MessageType.PlainText
				},
				fee: `FEE:${fee}`
			});
		});

		it('resolves recipient via alias and throws if not found', async () => {
			// Arrange:
			const alias = 'my.namespace';
			utils.isSymbolAddress.mockReturnValue(false);
			api.namespace.resolveAddress.mockResolvedValue(undefined);

			// Act & Assert:
			await expect(transferModule.createTransaction({
				recipientAddressOrAlias: alias,
				mosaics: [],
				messageText: '',
				isMessageEncrypted: false,
				fee: 0
			})).rejects.toThrow(ControllerError);

			expect(utils.namespaceIdFromName).toHaveBeenCalledWith(alias.toLowerCase());
			expect(api.namespace.resolveAddress).toHaveBeenCalled();
		});

		it('creates aggregate bonded for multisig and encrypts message', async () => {
			// Arrange:
			const senderPublicKey = 'MULTI_PUB';
			const recipientAddress = 'TARECIPIENT...';
			const mosaics = [{ mosaicId: 'AAA', amount: '1' }];
			const messageText = 'secret';
			const fee = 300;
			const password = 'pwd';

			utils.isSymbolAddress.mockReturnValue(true);
			api.account.fetchAccountInfo.mockResolvedValue({ publicKey: 'RECIP_PUB' });

			// Act:
			const tx = await transferModule.createTransaction({
				senderPublicKey,
				recipientAddressOrAlias: recipientAddress,
				mosaics,
				messageText,
				isMessageEncrypted: true,
				fee
			}, password);

			// Assert:
			expect(api.account.fetchAccountInfo).toHaveBeenCalledWith(networkProperties, recipientAddress);
			expect(walletController.encryptMessage).toHaveBeenCalledWith(messageText, 'RECIP_PUB', password);

			expect(tx.type).toBe(TransactionType.AGGREGATE_BONDED);
			expect(tx.signerPublicKey).toBe(currentAccount.publicKey);
			expect(tx.fee).toBe(`FEE:${fee}`);
			expect(tx.deadline).toBe('DL48');

			expect(tx.innerTransactions).toHaveLength(1);
			const inner = tx.innerTransactions[0];
			expect(inner).toEqual({
				type: TransactionType.TRANSFER,
				signerPublicKey: senderPublicKey,
				recipientAddress,
				mosaics,
				deadline: 'DL2',
				message: {
					text: messageText,
					payload: `ENC(${messageText})-for-RECIP_PUB`,
					type: MessageType.EncryptedText
				}
			});
		});
	});

	describe('getDecryptedMessageText()', () => {
		it('throws if transaction type is not TRANSFER', async () => {
			// Arrange:
			const tx = { type: TransactionType.ACCOUNT_KEY_LINK };

			// Act & Assert:
			await expect(transferModule.getDecryptedMessageText(tx, 'pwd')).rejects.toThrow(ControllerError);
		});

		it('decrypts incoming encrypted message using signer public key', async () => {
			// Arrange:
			const payload = 'ABCD';
			const signerPublicKey = 'SENDER_PK';
			const tx = {
				type: TransactionType.TRANSFER,
				signerPublicKey,
				recipientAddress: currentAccount.address,
				message: { type: MessageType.EncryptedText, payload }
			};

			utils.isIncomingTransaction.mockReturnValue(true);

			// Act:
			const result = await transferModule.getDecryptedMessageText(tx, 'pwd');

			// Assert:
			expect(utils.isIncomingTransaction).toHaveBeenCalledWith(tx, currentAccount);
			expect(walletController.decryptMessage).toHaveBeenCalledWith(payload, signerPublicKey, 'pwd');
			expect(result).toBe(`DEC(${payload})-with-${signerPublicKey}`);
		});

		it('decrypts outgoing encrypted message using recipient public key', async () => {
			// Arrange:
			const payload = 'EF01';
			const recipientAddress = 'TARECIPIENT...';
			const recipientPublicKey = 'RECIPIENT_PK';
			const tx = {
				type: TransactionType.TRANSFER,
				signerPublicKey: currentAccount.publicKey,
				recipientAddress,
				message: { type: MessageType.EncryptedText, payload }
			};

			utils.isIncomingTransaction.mockReturnValue(false);
			utils.isOutgoingTransaction.mockReturnValue(true);
			api.account.fetchAccountInfo.mockResolvedValue({ publicKey: recipientPublicKey });

			// Act:
			const result = await transferModule.getDecryptedMessageText(tx, 'pwd');

			// Assert:
			expect(utils.isOutgoingTransaction).toHaveBeenCalledWith(tx, currentAccount);
			expect(api.account.fetchAccountInfo).toHaveBeenCalledWith(networkProperties, recipientAddress);
			expect(walletController.decryptMessage).toHaveBeenCalledWith(payload, recipientPublicKey, 'pwd');
			expect(result).toBe(`DEC(${payload})-with-${recipientPublicKey}`);
		});

		it('throws when transaction is neither incoming nor outgoing relative to current account', async () => {
			// Arrange:
			const tx = {
				type: TransactionType.TRANSFER,
				signerPublicKey: 'OTHER',
				recipientAddress: 'TAXXX',
				message: { type: MessageType.EncryptedText, payload: 'FF' }
			};
			utils.isIncomingTransaction.mockReturnValue(false);
			utils.isOutgoingTransaction.mockReturnValue(false);

			// Act & Assert:
			await expect(transferModule.getDecryptedMessageText(tx, 'pwd')).rejects.toThrow(ControllerError);
		});
	});
});
