import { useTransactionSender } from '@/app/hooks/useTransactionSender';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { act, renderHook } from '@testing-library/react-native';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const CURRENT_BALANCE = '1000000000';

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const firstMultisigAccount = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.setBalance('500000000')
	.build();

const secondMultisigAccount = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 4)
	.setBalance('700000000')
	.build();

const MULTISIG_ACCOUNTS = [firstMultisigAccount, secondMultisigAccount];

// Mock Wallet Controller

const createMockWalletController = ({ multisigAccounts = [] } = {}) => ({
	currentAccount,
	currentAccountInfo: { balance: CURRENT_BALANCE },
	modules: {
		multisig: {
			multisigAccounts,
			fetchData: jest.fn().mockResolvedValue(multisigAccounts)
		}
	}
});

describe('hooks/useTransactionSender', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('options', () => {
		it('exposes the current account address and balance', () => {
			// Arrange:
			const walletController = createMockWalletController();

			// Act:
			const { result } = renderHook(() => useTransactionSender(walletController));

			// Assert:
			expect(result.current.options.current).toEqual({
				address: currentAccount.address,
				balance: CURRENT_BALANCE
			});
		});

		it('exposes the multisig accounts the current account can send from', () => {
			// Arrange:
			const walletController = createMockWalletController({ multisigAccounts: MULTISIG_ACCOUNTS });

			// Act:
			const { result } = renderHook(() => useTransactionSender(walletController));

			// Assert:
			expect(result.current.options.multisigAccounts).toEqual(MULTISIG_ACCOUNTS);
		});

		it('defaults the current account balance to zero when account info is unavailable', () => {
			// Arrange:
			const walletController = { ...createMockWalletController(), currentAccountInfo: null };

			// Act:
			const { result } = renderHook(() => useTransactionSender(walletController));

			// Assert:
			expect(result.current.options.current.balance).toBe('0');
		});
	});

	describe('selected sender', () => {
		it('selects the current account by default', () => {
			// Arrange:
			const walletController = createMockWalletController({ multisigAccounts: MULTISIG_ACCOUNTS });

			// Act:
			const { result } = renderHook(() => useTransactionSender(walletController));

			// Assert:
			expect(result.current.value).toBe(currentAccount.address);
			expect(result.current.isMultisigSelected).toBe(false);
			expect(result.current.selectedAccount.address).toBe(currentAccount.address);
			expect(result.current.selectedAccount.publicKey).toBe(currentAccount.publicKey);
		});

		it('pre-selects the provided initial address', () => {
			// Arrange:
			const walletController = createMockWalletController({ multisigAccounts: MULTISIG_ACCOUNTS });

			// Act:
			const { result } = renderHook(() => useTransactionSender(walletController, { initialAddress: firstMultisigAccount.address }));

			// Assert:
			expect(result.current.value).toBe(firstMultisigAccount.address);
			expect(result.current.isMultisigSelected).toBe(true);
		});

		it('resolves the selected multisig account info when a multisig sender is chosen', () => {
			// Arrange:
			const walletController = createMockWalletController({ multisigAccounts: MULTISIG_ACCOUNTS });
			const { result } = renderHook(() => useTransactionSender(walletController));

			// Act:
			act(() => {
				result.current.changeValue(firstMultisigAccount.address);
			});

			// Assert:
			expect(result.current.value).toBe(firstMultisigAccount.address);
			expect(result.current.isMultisigSelected).toBe(true);
			expect(result.current.selectedAccount).toEqual(firstMultisigAccount);
		});
	});

	describe('load', () => {
		it('fetches the multisig account list', async () => {
			// Arrange:
			const walletController = createMockWalletController({ multisigAccounts: MULTISIG_ACCOUNTS });
			const { result } = renderHook(() => useTransactionSender(walletController));

			// Act:
			await act(async () => {
				result.current.load();
				jest.runAllTimers();
			});

			// Assert:
			expect(walletController.modules.multisig.fetchData).toHaveBeenCalledTimes(1);
		});
	});
});
