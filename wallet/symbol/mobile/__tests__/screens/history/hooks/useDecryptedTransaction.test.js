import { SymbolTransactionType } from '@/app/constants';
import { useDecryptedTransaction } from '@/app/screens/history/hooks/useDecryptedTransaction';
import { TransferTransactionFixtureBuilder } from '__fixtures__/local/TransferTransactionFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { createWalletControllerMock } from '__tests__/mock-helpers';

// Constants

const TX_HASH = '0C905EB065E6A42029CD1A10E710422761495A63D433535BA6EAA9BCF36AB8B6';
const ENCRYPTED_PAYLOAD = '0100AABBCCDDEEFF';
const PLAIN_TEXT = 'Hello plain';
const DECRYPTED_TEXT = 'Decrypted secret message';

const DecryptBehavior = {
	SUCCESS: 'success',
	FAILURE: 'failure'
};

// Fixtures

const buildEncryptedTransfer = () => TransferTransactionFixtureBuilder
	.createDefault()
	.setHash(TX_HASH)
	.setEncryptedMessage(ENCRYPTED_PAYLOAD)
	.build();

const buildPlainTransfer = () => TransferTransactionFixtureBuilder
	.createDefault()
	.setHash(TX_HASH)
	.setPlainMessage(PLAIN_TEXT)
	.build();

const buildEncryptedNonTransfer = () => TransferTransactionFixtureBuilder
	.createDefault()
	.setHash(TX_HASH)
	.setEncryptedMessage(ENCRYPTED_PAYLOAD)
	.setType(SymbolTransactionType.AGGREGATE_BONDED)
	.build();

const encryptedTransfer = buildEncryptedTransfer();
const plainTransfer = buildPlainTransfer();
const encryptedNonTransfer = buildEncryptedNonTransfer();

// Mock Creators

const createDecryptMock = behavior => behavior === DecryptBehavior.FAILURE
	? jest.fn().mockRejectedValue(new Error('decrypt failed'))
	: jest.fn().mockResolvedValue(DECRYPTED_TEXT);

const createControllerWithDecryptMock = getDecryptedMessageText => createWalletControllerMock({
	modules: {
		transfer: { getDecryptedMessageText }
	}
});

describe('screens/history/hooks/useDecryptedTransaction', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('decryption', () => {
		const runDecryptionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const getDecryptedMessageText = createDecryptMock(config.decryptBehavior);
				const walletController = createControllerWithDecryptMock(getDecryptedMessageText);
				const { transaction } = config;

				// Act:
				const hookTester = new HookTester(useDecryptedTransaction, [walletController, transaction]);
				await hookTester.waitForTimer();

				// Assert:
				expect(getDecryptedMessageText).toHaveBeenCalledTimes(expected.decryptCallCount);
				if (expected.decryptCallCount > 0)
					expect(getDecryptedMessageText).toHaveBeenCalledWith(transaction);

				expect(hookTester.currentResult.message.text).toBe(expected.messageText);
				expect(hookTester.currentResult.message.payload).toBe(transaction.message.payload);
				expect(hookTester.currentResult.message.type).toBe(transaction.message.type);

				if (expected.returnsOriginal)
					expect(hookTester.currentResult).toBe(transaction);
				else
					expect(hookTester.currentResult).not.toBe(transaction);
			});
		};

		const decryptionTests = [
			{
				description: 'decrypts an encrypted transfer and returns the transaction with decrypted text',
				config: {
					transaction: encryptedTransfer,
					decryptBehavior: DecryptBehavior.SUCCESS
				},
				expected: {
					decryptCallCount: 1,
					messageText: DECRYPTED_TEXT,
					returnsOriginal: false
				}
			},
			{
				description: 'returns the original transaction for a plain message without decrypting',
				config: {
					transaction: plainTransfer
				},
				expected: {
					decryptCallCount: 0,
					messageText: PLAIN_TEXT,
					returnsOriginal: true
				}
			},
			{
				description: 'returns the original transaction for a non-transfer type without decrypting',
				config: {
					transaction: encryptedNonTransfer
				},
				expected: {
					decryptCallCount: 0,
					messageText: null,
					returnsOriginal: true
				}
			},
			{
				description: 'falls back to the original transaction when decryption fails',
				config: {
					transaction: encryptedTransfer,
					decryptBehavior: DecryptBehavior.FAILURE
				},
				expected: {
					decryptCallCount: 1,
					messageText: null,
					returnsOriginal: true
				}
			}
		];

		decryptionTests.forEach(test => {
			runDecryptionTest(test.description, test.config, test.expected);
		});
	});

	describe('rendering behavior', () => {
		it('does not mutate the original transaction', async () => {
			// Arrange:
			const walletController = createControllerWithDecryptMock(createDecryptMock(DecryptBehavior.SUCCESS));
			const transaction = buildEncryptedTransfer();

			// Act:
			const hookTester = new HookTester(useDecryptedTransaction, [walletController, transaction]);
			await hookTester.waitForTimer();

			// Assert:
			expect(transaction.message.text).toBeNull();
			expect(hookTester.currentResult).not.toBe(transaction);
		});

		it('does not re-decrypt when re-rendered with an equivalent transaction (same hash and payload)', async () => {
			// Arrange:
			const getDecryptedMessageText = createDecryptMock(DecryptBehavior.SUCCESS);
			const walletController = createControllerWithDecryptMock(getDecryptedMessageText);
			const hookTester = new HookTester(useDecryptedTransaction, [walletController, buildEncryptedTransfer()]);
			await hookTester.waitForTimer();

			// Act: simulate a polling update returning a new object with identical hash and payload
			hookTester.updateProps([walletController, buildEncryptedTransfer()]);
			await hookTester.waitForTimer();

			// Assert:
			expect(getDecryptedMessageText).toHaveBeenCalledTimes(1);
			expect(hookTester.currentResult.message.text).toBe(DECRYPTED_TEXT);
		});
	});
});
