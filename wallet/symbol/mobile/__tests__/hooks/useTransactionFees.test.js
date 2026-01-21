import { useTransactionFees } from '@/app/hooks/useTransactionFees';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { act, renderHook } from '@testing-library/react-native';

const MOCK_TRANSACTION = {
	type: 'transfer',
	recipientAddress: 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
	mosaics: [],
	message: 'test message'
};

const TRANSACTION_FEE_TOKEN = TokenFixtureBuilder
	.createWithToken('symbol', 'testnet', 0)
	.setAmount(100000)
	.data;

const TRANSACTION_FEES = {
	slow: { token: TRANSACTION_FEE_TOKEN },
	medium: { token: { ...TRANSACTION_FEE_TOKEN, amount: 200000 } },
	fast: { token: { ...TRANSACTION_FEE_TOKEN, amount: 300000 } }
};

const createMockWalletController = (overrides = {}) => ({
	modules: {
		transfer: {
			calculateTransactionFees: jest.fn().mockResolvedValue(TRANSACTION_FEES)
		}
	},
	...overrides
});

const createMockTransaction = (transaction = MOCK_TRANSACTION) => {
	return jest.fn().mockResolvedValue(transaction);
};

describe('hooks/useTransactionFees', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('initial state', () => {
		it('returns initial state with null data and not loading', () => {
			// Arrange:
			const createTransaction = createMockTransaction();
			const walletController = createMockWalletController();

			// Act:
			const { result } = renderHook(() => useTransactionFees(createTransaction, walletController));

			// Assert:
			expect(result.current.data).toBeNull();
			expect(result.current.isLoading).toBe(false);
		});

		it('does not call createTransaction on mount', () => {
			// Arrange:
			const createTransaction = createMockTransaction();
			const walletController = createMockWalletController();

			// Act:
			renderHook(() => useTransactionFees(createTransaction, walletController));

			// Assert:
			expect(createTransaction).not.toHaveBeenCalled();
		});
	});

	describe('fee calculation', () => {
		it('calculates transaction fees when call is triggered', async () => {
			// Arrange:
			const createTransaction = createMockTransaction();
			const walletController = createMockWalletController();
			const { result } = renderHook(() => useTransactionFees(createTransaction, walletController));

			// Act:
			await act(async () => {
				const promise = result.current.call();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(createTransaction).toHaveBeenCalledTimes(1);
			expect(walletController.modules.transfer.calculateTransactionFees).toHaveBeenCalledWith(MOCK_TRANSACTION);
			expect(result.current.data).toEqual(TRANSACTION_FEES);
		});

		it('sets loading state when call is invoked', async () => {
			// Arrange:
			const createTransaction = createMockTransaction();
			const walletController = createMockWalletController();
			const { result } = renderHook(() => useTransactionFees(createTransaction, walletController));

			// Act:
			act(() => {
				result.current.call();
			});

			// Assert:
			expect(result.current.isLoading).toBe(true);

			// Cleanup:
			await act(async () => {
				jest.runAllTimers();
			});
		});

		it('clears loading state after calculation completes', async () => {
			// Arrange:
			const createTransaction = createMockTransaction();
			const walletController = createMockWalletController();
			const { result } = renderHook(() => useTransactionFees(createTransaction, walletController));

			// Act:
			await act(async () => {
				const promise = result.current.call();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(result.current.isLoading).toBe(false);
		});
	});
});
