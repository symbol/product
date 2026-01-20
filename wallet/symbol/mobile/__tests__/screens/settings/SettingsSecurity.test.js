import { passcodeManager } from '@/app/lib/passcode';
import { SettingsSecurity } from '@/app/screens/settings/SettingsSecurity';
import { mnemonic } from '__fixtures__/local/wallet';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockWalletController } from '__tests__/mock-helpers';

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
	getMnemonic: jest.fn().mockResolvedValue(TEST_MNEMONIC),
	...overrides
});

const mockPasscodeManager = (overrides = {}) => {
	passcodeManager.isPasscodeSet.mockResolvedValue(overrides.isPasscodeSet ?? false);
	passcodeManager.clear.mockResolvedValue();
};

describe('screens/settings/SettingsSecurity', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	describe('render', () => {
		it('renders all security settings elements', async () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			mockPasscodeManager();
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
	});

	describe('passcode', () => {
		it('loads passcode status on mount', async () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			mockPasscodeManager();

			// Act:
			const screenTester = new ScreenTester(SettingsSecurity);
			await screenTester.waitForTimer();

			// Assert:
			expect(passcodeManager.isPasscodeSet).toHaveBeenCalledTimes(1);
		});

		const runPasscodeTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletController(createMockWalletController());
				mockPasscodeManager({ isPasscodeSet: config.isPasscodeSet });
				mockPasscode();

				// Act:
				const screenTester = new ScreenTester(SettingsSecurity);
				await screenTester.waitForTimer(); // initial load
				screenTester.pressButton(SCREEN_TEXT.pinToggle);
				await screenTester.waitForTimer(); // clear (optional)
				await screenTester.waitForTimer(); // reload

				// Assert:
				expect(passcodeManager.isPasscodeSet).toHaveBeenCalledTimes(2);
				
				if (expected.shouldBeCleared)
					expect(passcodeManager.clear).toHaveBeenCalledTimes(1);
				else
					expect(passcodeManager.clear).toHaveBeenCalledTimes(0); 
			});
		};

		const passcodeTests = [
			{
				description: 'disables passcode and clears it when toggle is pressed',
				config: { isPasscodeSet: true },
				expected: { shouldBeCleared: true }
			},
			{
				description: 'enables passcode when toggle is pressed',
				config: { isPasscodeSet: false },
				expected: { shouldBeCleared: false }
			}
		];

		passcodeTests.forEach(test => {
			runPasscodeTest(test.description, test.config, test.expected);
		});
	});

	describe('mnemonic', () => {
		it('does not load mnemonic on mount', async () => {
			// Arrange:
			const walletControllerMock = mockWalletController(createMockWalletController());
			mockPasscodeManager();

			// Act:
			const screenTester = new ScreenTester(SettingsSecurity);
			await screenTester.waitForTimer();

			// Assert:
			expect(walletControllerMock.getMnemonic).toHaveBeenCalledTimes(0);
		});

		it('shows mnemonic when show button is pressed and passcode is verified', async () => {
			// Arrange:
			const walletControllerMock = mockWalletController(createMockWalletController());
			mockPasscodeManager({ isPasscodeSet: true });
			mockPasscode();

			// Act:
			const screenTester = new ScreenTester(SettingsSecurity);
			screenTester.pressButton(SCREEN_TEXT.showMnemonicButton);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([TEST_MNEMONIC]);
			screenTester.notExpectText([SCREEN_TEXT.showMnemonicButton]);
			expect(walletControllerMock.getMnemonic).toHaveBeenCalledTimes(1);
		});
	});
});
