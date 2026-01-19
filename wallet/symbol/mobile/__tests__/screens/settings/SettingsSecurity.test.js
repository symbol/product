import { passcodeManager } from '@/app/lib/passcode';
import { SettingsSecurity } from '@/app/screens/settings/SettingsSecurity';
import { mnemonic } from '__fixtures__/local/wallet';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';
import { waitFor } from '@testing-library/react-native';

jest.mock('@/app/lib/passcode', () => ({
	passcodeManager: {
		isPasscodeSet: jest.fn(),
		clear: jest.fn()
	}
}));

const TEST_MNEMONIC = mnemonic;

const SCREEN_TEXT = {
	pinTitle: 'settings_security_pin_title',
	pinBody: 'settings_security_pin_body',
	pinToggle: 'settings_security_pin_toggle',
	mnemonicTitle: 'settings_security_mnemonic_title',
	mnemonicBody: 'settings_security_mnemonic_body',
	showMnemonicButton: 'button_showMnemonic'
};

const createMockWalletController = (overrides = {}) => ({
	getMnemonic: jest.fn().mockResolvedValue(overrides.mnemonic ?? TEST_MNEMONIC),
	on: jest.fn(),
	removeListener: jest.fn(),
	...overrides
});

const createMockPasscodeManager = (overrides = {}) => {
	passcodeManager.isPasscodeSet.mockResolvedValue(overrides.isPasscodeSet ?? false);
	passcodeManager.clear.mockResolvedValue();
};

// === Tests ===

describe('screens/settings/SettingsSecurity', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	describe('render', () => {
		it('renders all security settings elements', async () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			createMockPasscodeManager();
			const expectedTexts = [
				SCREEN_TEXT.pinTitle,
				SCREEN_TEXT.pinBody,
				SCREEN_TEXT.pinToggle,
				SCREEN_TEXT.mnemonicTitle,
				SCREEN_TEXT.mnemonicBody
			];

			// Act:
			const screenTester = new ScreenTester(SettingsSecurity);

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('shows mnemonic placeholder when mnemonic is hidden', async () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			createMockPasscodeManager();

			// Act:
			const screenTester = new ScreenTester(SettingsSecurity);

			// Assert:
			screenTester.expectText([SCREEN_TEXT.showMnemonicButton]);
		});
	});

	describe('passcode toggle', () => {
		it('clears passcode when passcode is enabled and toggle is pressed', async () => {
			// Arrange:
			const walletControllerMock = createMockWalletController();
			mockWalletController(walletControllerMock);
			createMockPasscodeManager({ isPasscodeSet: true });
			mockPasscode();
			mockRouter({ goBack: jest.fn() });
			const screenTester = new ScreenTester(SettingsSecurity);

			// Act:
			await waitFor(() => {
				expect(passcodeManager.isPasscodeSet).toHaveBeenCalled();
			});
			screenTester.pressButton(SCREEN_TEXT.pinToggle);
			screenTester.waitForTimer();

			// Assert:
			expect(passcodeManager.clear).toHaveBeenCalledTimes(1);
		});

		it('does not clear passcode when passcode is disabled and toggle is pressed', async () => {
			// Arrange:
			const walletControllerMock = createMockWalletController();
			mockWalletController(walletControllerMock);
			createMockPasscodeManager({ isPasscodeSet: false });
			mockPasscode();
			mockRouter({ goBack: jest.fn() });
			const screenTester = new ScreenTester(SettingsSecurity);

			// Act:
			await waitFor(() => {
				screenTester.expectText([SCREEN_TEXT.pinToggle]);
			});
			screenTester.pressButton(SCREEN_TEXT.pinToggle);

			// Assert:
			await waitFor(() => {
				expect(passcodeManager.clear).not.toHaveBeenCalled();
			});
		});

		it('navigates back after toggling passcode', async () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			createMockPasscodeManager({ isPasscodeSet: true });
			mockPasscode();
			const routerMock = mockRouter({ goBack: jest.fn() });
			const screenTester = new ScreenTester(SettingsSecurity);

			// Act:
			await waitFor(() => {
				screenTester.expectText([SCREEN_TEXT.pinToggle]);
			});
			screenTester.pressButton(SCREEN_TEXT.pinToggle);

			// Assert:
			await waitFor(() => {
				expect(routerMock.goBack).toHaveBeenCalledTimes(1);
			});
		});
	});

	describe('mnemonic display', () => {
		it('shows mnemonic when show button is pressed and passcode is verified', async () => {
			// Arrange:
			mockWalletController(createMockWalletController({ mnemonic: TEST_MNEMONIC }));
			createMockPasscodeManager({ isPasscodeSet: true });
			mockPasscode();
			const screenTester = new ScreenTester(SettingsSecurity);

			// Act:
			await waitFor(() => {
				screenTester.expectText([SCREEN_TEXT.showMnemonicButton]);
			});
			screenTester.pressButton(SCREEN_TEXT.showMnemonicButton);

			// Assert:
			await waitFor(() => {
				screenTester.expectText([TEST_MNEMONIC]);
			});
		});

		it('hides show mnemonic button after mnemonic is revealed', async () => {
			// Arrange:
			mockWalletController(createMockWalletController({ mnemonic: TEST_MNEMONIC }));
			createMockPasscodeManager({ isPasscodeSet: true });
			mockPasscode();
			const screenTester = new ScreenTester(SettingsSecurity);

			// Act:
			await waitFor(() => {
				screenTester.expectText([SCREEN_TEXT.showMnemonicButton]);
			});
			screenTester.pressButton(SCREEN_TEXT.showMnemonicButton);

			// Assert:
			await waitFor(() => {
				screenTester.notExpectText([SCREEN_TEXT.showMnemonicButton]);
			});
		});
	});

	describe('data loading', () => {
		it('loads passcode status on mount', async () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			createMockPasscodeManager();

			// Act:
			new ScreenTester(SettingsSecurity);

			// Assert:
			await waitFor(() => {
				expect(passcodeManager.isPasscodeSet).toHaveBeenCalledTimes(1);
			});
		});

		it('loads mnemonic on mount', async () => {
			// Arrange:
			const walletControllerMock = createMockWalletController();
			mockWalletController(walletControllerMock);
			createMockPasscodeManager();

			// Act:
			new ScreenTester(SettingsSecurity);

			// Assert:
			await waitFor(() => {
				expect(walletControllerMock.getMnemonic).toHaveBeenCalledTimes(1);
			});
		});
	});
});
