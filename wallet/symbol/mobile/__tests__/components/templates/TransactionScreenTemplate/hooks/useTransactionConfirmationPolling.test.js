import { 
	useTransactionConfirmationPolling 
} from '@/app/components/templates/TransactionScreenTemplate/hooks/useTransactionConfirmationPolling';
import { act, renderHook } from '@testing-library/react-native';
import { TransactionGroup } from 'wallet-common-core/src/constants';


const TRANSACTION_HASH_1 = 'ABC123DEF456789012345678901234567890123456789012345678901234ABCD';
const TRANSACTION_HASH_2 = 'DEF456GHI789012345678901234567890123456789012345678901234567EFGH';
const TRANSACTION_HASH_3 = 'GHI789JKL012345678901234567890123456789012345678901234567890IJKL';

const POLLING_INTERVAL_MS = 1000;


const createMockWalletController = (statusMap = {}) => ({
	fetchTransactionStatus: jest.fn().mockImplementation(hash => {
		if (statusMap[hash]) 
			return Promise.resolve({ group: statusMap[hash] });
		
		return Promise.resolve({ group: null });
	})
});

const createDefaultParams = (overrides = {}) => ({
	walletController: createMockWalletController(),
	signedTransactionHashes: [],
	isActive: false,
	...overrides
});


describe('hooks/useTransactionConfirmationPolling', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('initialization', () => {
		it('initializes with empty arrays', () => {
			// Arrange:
			const params = createDefaultParams();

			// Act:
			const { result } = renderHook(() => useTransactionConfirmationPolling(params));

			// Assert:
			expect(result.current.confirmedTransactionHashes).toEqual([]);
			expect(result.current.failedTransactionHashes).toEqual([]);
			expect(result.current.partialTransactionHashes).toEqual([]);
		});
	});

	describe('polling', () => {
		it('does not poll when isActive is false', async () => {
			// Arrange:
			const mockWalletController = createMockWalletController();
			const params = createDefaultParams({
				walletController: mockWalletController,
				signedTransactionHashes: [TRANSACTION_HASH_1],
				isActive: false
			});

			// Act:
			renderHook(() => useTransactionConfirmationPolling(params));
			await act(async () => {
				jest.advanceTimersByTime(POLLING_INTERVAL_MS * 3);
			});

			// Assert:
			expect(mockWalletController.fetchTransactionStatus).not.toHaveBeenCalled();
		});

		it('does not poll when signedTransactionHashes is empty', async () => {
			// Arrange:
			const mockWalletController = createMockWalletController();
			const params = createDefaultParams({
				walletController: mockWalletController,
				signedTransactionHashes: [],
				isActive: true
			});

			// Act:
			renderHook(() => useTransactionConfirmationPolling(params));
			await act(async () => {
				jest.advanceTimersByTime(POLLING_INTERVAL_MS * 3);
			});

			// Assert:
			expect(mockWalletController.fetchTransactionStatus).not.toHaveBeenCalled();
		});

		it('polls for transaction status when active', async () => {
			// Arrange:
			const mockWalletController = createMockWalletController({
				[TRANSACTION_HASH_1]: TransactionGroup.CONFIRMED
			});
			const params = createDefaultParams({
				walletController: mockWalletController,
				signedTransactionHashes: [TRANSACTION_HASH_1],
				isActive: true
			});

			// Act:
			renderHook(() => useTransactionConfirmationPolling(params));
			await act(async () => {
				jest.advanceTimersByTime(POLLING_INTERVAL_MS);
			});

			// Assert:
			expect(mockWalletController.fetchTransactionStatus).toHaveBeenCalledWith(TRANSACTION_HASH_1);
		});
	});

	describe('transaction categorization', () => {
		const runCategorizationTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const mockWalletController = createMockWalletController(config.statusMap);
				const params = createDefaultParams({
					walletController: mockWalletController,
					signedTransactionHashes: config.hashes,
					isActive: true
				});

				// Act:
				const { result } = renderHook(() => useTransactionConfirmationPolling(params));
				await act(async () => {
					jest.advanceTimersByTime(POLLING_INTERVAL_MS);
				});

				// Assert:
				expect(result.current.confirmedTransactionHashes).toEqual(expected.confirmed);
				expect(result.current.failedTransactionHashes).toEqual(expected.failed);
				expect(result.current.partialTransactionHashes).toEqual(expected.partial);
			});
		};

		const tests = [
			{
				description: 'categorizes confirmed transactions',
				config: {
					hashes: [TRANSACTION_HASH_1],
					statusMap: { [TRANSACTION_HASH_1]: TransactionGroup.CONFIRMED }
				},
				expected: {
					confirmed: [TRANSACTION_HASH_1],
					failed: [],
					partial: []
				}
			},
			{
				description: 'categorizes failed transactions',
				config: {
					hashes: [TRANSACTION_HASH_1],
					statusMap: { [TRANSACTION_HASH_1]: TransactionGroup.FAILED }
				},
				expected: {
					confirmed: [],
					failed: [TRANSACTION_HASH_1],
					partial: []
				}
			},
			{
				description: 'categorizes partial transactions',
				config: {
					hashes: [TRANSACTION_HASH_1],
					statusMap: { [TRANSACTION_HASH_1]: TransactionGroup.PARTIAL }
				},
				expected: {
					confirmed: [],
					failed: [],
					partial: [TRANSACTION_HASH_1]
				}
			},
			{
				description: 'categorizes multiple transactions with different statuses',
				config: {
					hashes: [TRANSACTION_HASH_1, TRANSACTION_HASH_2, TRANSACTION_HASH_3],
					statusMap: {
						[TRANSACTION_HASH_1]: TransactionGroup.CONFIRMED,
						[TRANSACTION_HASH_2]: TransactionGroup.FAILED,
						[TRANSACTION_HASH_3]: TransactionGroup.PARTIAL
					}
				},
				expected: {
					confirmed: [TRANSACTION_HASH_1],
					failed: [TRANSACTION_HASH_2],
					partial: [TRANSACTION_HASH_3]
				}
			},
			{
				description: 'handles transactions with null status',
				config: {
					hashes: [TRANSACTION_HASH_1, TRANSACTION_HASH_2],
					statusMap: { [TRANSACTION_HASH_1]: TransactionGroup.CONFIRMED }
				},
				expected: {
					confirmed: [TRANSACTION_HASH_1],
					failed: [],
					partial: []
				}
			}
		];

		tests.forEach(test => {
			runCategorizationTest(test.description, test.config, test.expected);
		});
	});

	describe('error handling', () => {
		it('handles fetch errors gracefully', async () => {
			// Arrange:
			const mockWalletController = {
				fetchTransactionStatus: jest.fn()
					.mockRejectedValueOnce(new Error('Network error'))
					.mockResolvedValueOnce({ group: TransactionGroup.CONFIRMED })
			};
			const params = createDefaultParams({
				walletController: mockWalletController,
				signedTransactionHashes: [TRANSACTION_HASH_1, TRANSACTION_HASH_2],
				isActive: true
			});

			// Act:
			const { result } = renderHook(() => useTransactionConfirmationPolling(params));
			await act(async () => {
				jest.advanceTimersByTime(POLLING_INTERVAL_MS);
			});

			// Assert:
			expect(result.current.confirmedTransactionHashes).toEqual([TRANSACTION_HASH_2]);
			expect(result.current.failedTransactionHashes).toEqual([]);
		});
	});

	describe('reset', () => {
		it('clears all transaction hash arrays', async () => {
			// Arrange:
			const mockWalletController = createMockWalletController({
				[TRANSACTION_HASH_1]: TransactionGroup.CONFIRMED,
				[TRANSACTION_HASH_2]: TransactionGroup.FAILED,
				[TRANSACTION_HASH_3]: TransactionGroup.PARTIAL
			});
			const params = createDefaultParams({
				walletController: mockWalletController,
				signedTransactionHashes: [TRANSACTION_HASH_1, TRANSACTION_HASH_2, TRANSACTION_HASH_3],
				isActive: true
			});

			const { result } = renderHook(() => useTransactionConfirmationPolling(params));
			await act(async () => {
				jest.advanceTimersByTime(POLLING_INTERVAL_MS);
			});

			// Verify data was populated
			expect(result.current.confirmedTransactionHashes.length).toBeGreaterThan(0);

			// Act:
			act(() => {
				result.current.reset();
			});

			// Assert:
			expect(result.current.confirmedTransactionHashes).toEqual([]);
			expect(result.current.failedTransactionHashes).toEqual([]);
			expect(result.current.partialTransactionHashes).toEqual([]);
		});
	});
});
