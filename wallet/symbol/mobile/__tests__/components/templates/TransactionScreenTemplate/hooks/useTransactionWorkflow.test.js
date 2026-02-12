import { useTransactionWorkflow } from '@/app/components/templates/TransactionScreenTemplate/hooks/useTransactionWorkflow';
import { act, renderHook } from '@testing-library/react-native';

const MOCK_TRANSACTION_HASH = 'ABC123DEF456';
const MOCK_TRANSACTION_HASH_2 = 'GHI789JKL012';
const ERROR_MESSAGE = 'Transaction creation failed';

const MOCK_TRANSACTION_BUNDLE = {
	transactions: [{ type: 'transfer', fee: '100000' }],
	isComposite: false,
	applyFeeTier: jest.fn()
};

const MOCK_SIGNED_BUNDLE = {
	transactions: [
		{ hash: MOCK_TRANSACTION_HASH },
		{ hash: MOCK_TRANSACTION_HASH_2 }
	]
};

const MOCK_FEE_TIERS = [
	{
		slow: { fee: '100000', feeFormatted: '0.1' },
		medium: { fee: '200000', feeFormatted: '0.2' },
		fast: { fee: '300000', feeFormatted: '0.3' }
	}
];

const createMockWalletController = (overrides = {}) => ({
	signTransactionBundle: jest.fn().mockResolvedValue(MOCK_SIGNED_BUNDLE),
	announceSignedTransactionBundle: jest.fn().mockResolvedValue({}),
	...overrides
});

const createMockCreateTransactionCallback = (resolvedValue = MOCK_TRANSACTION_BUNDLE) =>
	jest.fn().mockResolvedValue(resolvedValue);

const createFailingCallback = (error = new Error(ERROR_MESSAGE)) =>
	jest.fn().mockRejectedValue(error);

const createDefaultParams = (overrides = {}) => ({
	createTransactionCallback: createMockCreateTransactionCallback(),
	walletController: createMockWalletController(),
	transactionFeeTiers: undefined,
	transactionFeeTierLevel: undefined,
	onCreateTransactionError: undefined,
	onSendSuccess: undefined,
	onSendError: undefined,
	...overrides
});

describe('hooks/useTransactionWorkflow', () => {
	let consoleErrorSpy;

	beforeEach(() => {
		jest.useFakeTimers();
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.useRealTimers();
		consoleErrorSpy.mockRestore();
	});

	describe('initialization', () => {
		it('initializes with default state', () => {
			// Arrange:
			const params = createDefaultParams();

			// Act:
			const { result } = renderHook(() => useTransactionWorkflow(params));

			// Assert:
			expect(result.current.transactionBundle).toBeNull();
			expect(result.current.signedTransactionHashes).toEqual([]);
			expect(result.current.createManager.isLoading).toBe(false);
			expect(result.current.signManager.isLoading).toBe(false);
			expect(result.current.announceManager.isLoading).toBe(false);
		});
	});

	describe('createTransaction', () => {
		it('creates transaction bundle successfully', async () => {
			// Arrange:
			const mockCallback = createMockCreateTransactionCallback();
			const params = createDefaultParams({ createTransactionCallback: mockCallback });
			const { result } = renderHook(() => useTransactionWorkflow(params));

			// Act:
			await act(async () => {
				const promise = result.current.createTransaction();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(mockCallback).toHaveBeenCalled();
			expect(result.current.transactionBundle).toEqual(MOCK_TRANSACTION_BUNDLE);
			expect(result.current.createManager.isLoading).toBe(false);
		});

		it('applies fee tiers when provided', async () => {
			// Arrange:
			const mockBundle = {
				...MOCK_TRANSACTION_BUNDLE,
				applyFeeTier: jest.fn()
			};
			const mockCallback = createMockCreateTransactionCallback(mockBundle);
			const params = createDefaultParams({
				createTransactionCallback: mockCallback,
				transactionFeeTiers: MOCK_FEE_TIERS,
				transactionFeeTierLevel: 'fast'
			});
			const { result } = renderHook(() => useTransactionWorkflow(params));

			// Act:
			await act(async () => {
				const promise = result.current.createTransaction();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(mockBundle.applyFeeTier).toHaveBeenCalledWith(MOCK_FEE_TIERS, 'fast');
		});

		it('calls onCreateTransactionError when creation fails', async () => {
			// Arrange:
			const error = new Error(ERROR_MESSAGE);
			const mockCallback = createFailingCallback(error);
			const onCreateTransactionError = jest.fn();
			const params = createDefaultParams({
				createTransactionCallback: mockCallback,
				onCreateTransactionError
			});
			const { result } = renderHook(() => useTransactionWorkflow(params));

			// Act:
			await act(async () => {
				try {
					const promise = result.current.createTransaction();
					jest.runAllTimers();
					await promise;
				} catch {
					// Expected to throw
				}
			});

			// Assert:
			expect(onCreateTransactionError).toHaveBeenCalledWith(error);
		});

		it('sets loading state during creation', async () => {
			// Arrange:
			const mockCallback = createMockCreateTransactionCallback();
			const params = createDefaultParams({ createTransactionCallback: mockCallback });
			const { result } = renderHook(() => useTransactionWorkflow(params));

			// Act:
			act(() => {
				result.current.createTransaction();
			});

			// Assert:
			expect(result.current.createManager.isLoading).toBe(true);
		});
	});

	describe('executeSignAndAnnounce', () => {
		it('signs and announces transaction successfully', async () => {
			// Arrange:
			const mockWalletController = createMockWalletController();
			const onSendSuccess = jest.fn();
			const params = createDefaultParams({
				walletController: mockWalletController,
				onSendSuccess
			});
			const { result } = renderHook(() => useTransactionWorkflow(params));

			// Create transaction first
			await act(async () => {
				const promise = result.current.createTransaction();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			let executePromise;
			act(() => {
				executePromise = result.current.executeSignAndAnnounce();
			});

			// Run timers for sign manager
			await act(async () => {
				jest.runAllTimers();
			});

			// Run timers for announce manager
			await act(async () => {
				jest.runAllTimers();
			});

			await executePromise;

			// Assert:
			expect(mockWalletController.signTransactionBundle).toHaveBeenCalledWith(MOCK_TRANSACTION_BUNDLE);
			expect(mockWalletController.announceSignedTransactionBundle).toHaveBeenCalledWith(MOCK_SIGNED_BUNDLE);
			expect(onSendSuccess).toHaveBeenCalled();
		});

		it('stores signed transaction hashes after signing', async () => {
			// Arrange:
			const params = createDefaultParams();
			const { result } = renderHook(() => useTransactionWorkflow(params));

			await act(async () => {
				const promise = result.current.createTransaction();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			let executePromise;
			act(() => {
				executePromise = result.current.executeSignAndAnnounce();
			});

			await act(async () => {
				jest.runAllTimers();
			});

			await act(async () => {
				jest.runAllTimers();
			});

			await executePromise;

			// Assert:
			expect(result.current.signedTransactionHashes).toEqual([
				MOCK_TRANSACTION_HASH,
				MOCK_TRANSACTION_HASH_2
			]);
		});

		it('calls onSendError when signing fails', async () => {
			// Arrange:
			const error = new Error('Signing failed');
			const mockWalletController = createMockWalletController({
				signTransactionBundle: jest.fn().mockRejectedValue(error)
			});
			const onSendError = jest.fn();
			const params = createDefaultParams({
				walletController: mockWalletController,
				onSendError
			});
			const { result } = renderHook(() => useTransactionWorkflow(params));

			await act(async () => {
				const promise = result.current.createTransaction();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			let executePromise;
			act(() => {
				executePromise = result.current.executeSignAndAnnounce();
			});

			await act(async () => {
				jest.runAllTimers();
			});

			await executePromise;

			// Assert:
			expect(onSendError).toHaveBeenCalledWith(error);
		});

		it('calls onSendError when announcement fails', async () => {
			// Arrange:
			const error = new Error('Announcement failed');
			const mockWalletController = createMockWalletController({
				announceSignedTransactionBundle: jest.fn().mockRejectedValue(error)
			});
			const onSendError = jest.fn();
			const params = createDefaultParams({
				walletController: mockWalletController,
				onSendError
			});
			const { result } = renderHook(() => useTransactionWorkflow(params));

			await act(async () => {
				const promise = result.current.createTransaction();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			let executePromise;
			act(() => {
				executePromise = result.current.executeSignAndAnnounce();
			});

			await act(async () => {
				jest.runAllTimers();
			});

			await act(async () => {
				jest.runAllTimers();
			});

			await executePromise;

			// Assert:
			expect(onSendError).toHaveBeenCalledWith(error);
		});
	});

	describe('reset', () => {
		it('resets all state to initial values', async () => {
			// Arrange:
			const params = createDefaultParams();
			const { result } = renderHook(() => useTransactionWorkflow(params));

			await act(async () => {
				const promise = result.current.createTransaction();
				jest.runAllTimers();
				await promise;
			});

			let executePromise;
			act(() => {
				executePromise = result.current.executeSignAndAnnounce();
			});

			await act(async () => {
				jest.runAllTimers();
			});

			await act(async () => {
				jest.runAllTimers();
			});

			await executePromise;

			// Act:
			act(() => {
				result.current.reset();
			});

			// Assert:
			expect(result.current.transactionBundle).toBeNull();
			expect(result.current.signedTransactionHashes).toEqual([]);
			expect(result.current.createManager.isLoading).toBe(false);
			expect(result.current.createManager.data).toBeNull();
		});
	});
});
