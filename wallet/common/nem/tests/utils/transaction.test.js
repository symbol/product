import { TransactionType } from '../../src/constants';
import {
	cosignTransaction,
	createDeadline,
	decodePlainMessage,
	decryptMessage,
	encodePlainMessage,
	encryptMessage,
	isIncomingTransaction,
	isMultisigTransaction,
	isOutgoingTransaction,
	nemTimestampToDate,
	normalizeTransactionHash,
	signTransaction,
	signTransactionBundle
} from '../../src/utils';
import { networkProperties } from '../__fixtures__/local/network';
import { walletStorageAccounts } from '../__fixtures__/local/wallet';
import { utils } from 'symbol-sdk';
import { models } from 'symbol-sdk/nem';
import { TransactionBundle } from 'wallet-common-core';

// Constants

const NETWORK_TIME = networkProperties.networkTime;
const NEM_TIMESTAMP_SECONDS = NETWORK_TIME / 1000;
const MULTISIG_HASH = 'A'.repeat(64);

// Deterministic hash of the signed transfer below (the transaction's identity).
const SIGNED_TRANSFER_HASH = '7DC799D4B3EBE14C5525EF3CCC94EF11AF9F8D73F8A28DE723BCB9B0B2A76F41';

// Fixtures

const signerAccount = walletStorageAccounts.testnet[0];
const recipientAccount = walletStorageAccounts.testnet[1];

// A transfer descriptor signed across the signing tests. The signer public key is derived during signing.
const signableTransfer = {
	type: TransactionType.TRANSFER,
	recipientAddress: recipientAccount.address,
	mosaics: [{ id: 'nem.xem', name: 'XEM', amount: '10', divisibility: 6 }],
	message: null,
	fee: { token: { amount: '0.1', divisibility: 6, id: 'nem.xem', name: 'XEM' } },
	deadline: createDeadline(NETWORK_TIME)
};

describe('utils/transaction', () => {
	describe('nemTimestampToDate', () => {
		it('converts a NEM timestamp in seconds to a Unix timestamp in milliseconds', () => {
			// Arrange:
			const expectedUnixMilliseconds = 1682039643000;

			// Act:
			const result = nemTimestampToDate(NEM_TIMESTAMP_SECONDS);

			// Assert:
			expect(result).toBe(expectedUnixMilliseconds);
		});
	});

	describe('createDeadline', () => {
		it('creates a deadline two hours ahead of the network time by default', () => {
			// Arrange: the adjusted timestamp/deadline are NEM seconds; timestamp is the Unix-ms expiry.
			const expectedDeadline = {
				timestamp: 1682046843000,
				adjusted: { timestamp: 254452058, deadline: 254459258 }
			};

			// Act:
			const result = createDeadline(NETWORK_TIME);

			// Assert:
			expect(result).toStrictEqual(expectedDeadline);
		});

		it('creates a deadline using the provided deadline window in hours', () => {
			// Arrange:
			const deadlineHours = 24;
			const expectedDeadline = {
				timestamp: 1682126043000,
				adjusted: { timestamp: 254452058, deadline: 254538458 }
			};

			// Act:
			const result = createDeadline(NETWORK_TIME, deadlineHours);

			// Assert:
			expect(result).toStrictEqual(expectedDeadline);
		});
	});

	describe('normalizeTransactionHash', () => {
		it('converts a lowercase hash to uppercase', () => {
			// Arrange:
			const hash = 'cc317a7674d56352b4c711096a7594bd11908bf518293a191fc2faa12eac0fbb';
			const expectedHash = hash.toUpperCase();

			// Act:
			const result = normalizeTransactionHash(hash);

			// Assert:
			expect(result).toBe(expectedHash);
		});

		it('throws a TypeError when the hash is not a string', () => {
			// Act & Assert:
			[123, null, undefined].forEach(input => expect(() => normalizeTransactionHash(input)).toThrow(TypeError));
		});
	});

	describe('isMultisigTransaction', () => {
		const runIsMultisigTransactionTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = isMultisigTransaction(config.transaction);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const isMultisigTransactionTests = [
			{
				description: 'returns true for a multisig transaction',
				config: { transaction: { type: TransactionType.MULTISIG } },
				expected: { result: true }
			},
			{
				description: 'returns false for a non-multisig transaction',
				config: { transaction: { type: TransactionType.TRANSFER } },
				expected: { result: false }
			}
		];

		isMultisigTransactionTests.forEach(test => runIsMultisigTransactionTest(test.description, test.config, test.expected));
	});

	describe('isOutgoingTransaction', () => {
		it('returns true when the signer address matches the current account', () => {
			// Arrange:
			const transaction = { signerAddress: signerAccount.address };

			// Act:
			const result = isOutgoingTransaction(transaction, signerAccount);

			// Assert:
			expect(result).toBe(true);
		});

		it('returns false when the signer address does not match the current account', () => {
			// Arrange:
			const transaction = { signerAddress: recipientAccount.address };

			// Act:
			const result = isOutgoingTransaction(transaction, signerAccount);

			// Assert:
			expect(result).toBe(false);
		});
	});

	describe('isIncomingTransaction', () => {
		it('returns true when the recipient address matches the current account', () => {
			// Arrange:
			const transaction = { recipientAddress: signerAccount.address };

			// Act:
			const result = isIncomingTransaction(transaction, signerAccount);

			// Assert:
			expect(result).toBe(true);
		});

		it('returns false when the recipient address does not match the current account', () => {
			// Arrange:
			const transaction = { recipientAddress: recipientAccount.address };

			// Act:
			const result = isIncomingTransaction(transaction, signerAccount);

			// Assert:
			expect(result).toBe(false);
		});
	});

	describe('encodePlainMessage', () => {
		it('encodes plain text as a hex message payload', () => {
			// Arrange:
			const messageText = 'Good luck!';
			const expectedPayload = '476f6f64206c75636b21';

			// Act:
			const result = encodePlainMessage(messageText);

			// Assert:
			expect(result).toBe(expectedPayload);
		});
	});

	describe('decodePlainMessage', () => {
		it('decodes a hex message payload back to plain text', () => {
			// Arrange:
			const messagePayload = '476f6f64206c75636b21';
			const expectedText = 'Good luck!';

			// Act:
			const result = decodePlainMessage(messagePayload);

			// Assert:
			expect(result).toBe(expectedText);
		});
	});

	describe('encryptMessage', () => {
		it('encrypts a message that can be decrypted back to the original text', () => {
			// Arrange:
			const messageText = 'secret hello';

			// Act: the NEM deprecated scheme derives the same shared secret from either side.
			const encryptedMessage = encryptMessage(messageText, recipientAccount.publicKey, signerAccount.privateKey);
			const decryptedMessage = decryptMessage(encryptedMessage, recipientAccount.publicKey, signerAccount.privateKey);

			// Assert:
			expect(decryptedMessage).toBe(messageText);
		});
	});

	describe('decryptMessage', () => {
		it('throws when the message cannot be decrypted with the given keys', () => {
			// Arrange: encrypting for the recipient, then decrypting with an unrelated public key yields a
			// different shared secret.
			const unrelatedAccount = walletStorageAccounts.testnet[2];
			const encryptedMessage = encryptMessage('secret hello', recipientAccount.publicKey, signerAccount.privateKey);

			// Act & Assert:
			expect(() => decryptMessage(encryptedMessage, unrelatedAccount.publicKey, signerAccount.privateKey))
				.toThrow('Failed to decrypt the message');
		});
	});

	describe('signTransaction', () => {
		it('signs a transaction and returns its hash and announce payload', () => {
			// Arrange:
			const expectedResult = {
				hash: SIGNED_TRANSFER_HASH,
				dto: {
					data: expect.stringMatching(/^[0-9A-F]+$/i),
					signature: expect.stringMatching(/^[0-9A-F]{128}$/i)
				}
			};

			// Act:
			const result = signTransaction(networkProperties.networkIdentifier, signableTransfer, signerAccount.privateKey);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		});
	});

	describe('signTransactionBundle', () => {
		it('signs every transaction in the bundle and preserves the metadata', () => {
			// Arrange:
			const metadata = { type: 'default' };
			const transactionBundle = new TransactionBundle([signableTransfer], metadata);
			const expectedSignedTransaction =
				signTransaction(networkProperties.networkIdentifier, signableTransfer, signerAccount.privateKey);

			// Act:
			const result = signTransactionBundle(networkProperties.networkIdentifier, transactionBundle, signerAccount.privateKey);

			// Assert:
			expect(result).toBeInstanceOf(TransactionBundle);
			expect(result.metadata).toStrictEqual(metadata);
			expect(result.transactions).toStrictEqual([expectedSignedTransaction]);
		});
	});

	describe('cosignTransaction', () => {
		it('builds a cosignature whose timestamp and deadline are derived from the network time', () => {
			// Arrange:
			const transaction = {
				networkIdentifier: networkProperties.networkIdentifier,
				hash: MULTISIG_HASH,
				multisigAccountAddress: recipientAccount.address,
				networkTime: NETWORK_TIME
			};
			const { adjusted } = createDeadline(NETWORK_TIME);

			// Act:
			const result = cosignTransaction(transaction, signerAccount.privateKey);
			// dto.data is the non-verifiable announce body, so deserialize it as a non-verifiable cosignature.
			const cosignature = models.NonVerifiableCosignatureV1.deserialize(utils.hexToUint8(result.dto.data));

			// Assert:
			expect(Number(cosignature.timestamp)).toBe(adjusted.timestamp);
			expect(Number(cosignature.deadline)).toBe(adjusted.deadline);
			expect(result).toStrictEqual({
				hash: expect.stringMatching(/^[0-9A-F]{64}$/),
				signerPublicKey: signerAccount.publicKey,
				dto: {
					data: expect.stringMatching(/^[0-9A-F]+$/i),
					signature: expect.stringMatching(/^[0-9A-F]{128}$/i)
				}
			});
		});

		it('throws when the hash or multisig account address is missing', () => {
			// Arrange:
			const transaction = { networkIdentifier: networkProperties.networkIdentifier, networkTime: NETWORK_TIME };

			// Act & Assert:
			expect(() => cosignTransaction(transaction, signerAccount.privateKey))
				.toThrow('cosignTransaction requires hash and multisigAccountAddress on the transaction object');
		});
	});
});
