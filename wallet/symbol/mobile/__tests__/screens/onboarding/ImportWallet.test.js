import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { ImportWallet } from '@/app/screens/onboarding/ImportWallet';
import { mnemonic } from '__fixtures__/local/wallet';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockWalletController } from '__tests__/mock-helpers';
import { runScreenNavigationTest } from '__tests__/screen-tests';

const TEST_MNEMONIC = mnemonic;
const DEFAULT_ACCOUNT_NAME = 's_importWallet_defaultAccountName';

const SCREEN_TEXT = {
	textScreenTitle: 's_importWallet_title',
	textScreenDescription: 's_importWallet_text',
	inputMnemonicLabel: 'input_mnemonic',
	buttonNext: 'button_next',
	buttonCancel: 'button_cancel'
};

describe('screens/onboarding/ImportWallet', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockLocalization();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	it('import wallet flow', async () => {
		// Arrange:
		mockPasscode();
		const walletControllerMock = mockWalletController();
		const screenText = [
			SCREEN_TEXT.textScreenTitle,
			SCREEN_TEXT.textScreenDescription
		];
		const buttonNextText = SCREEN_TEXT.buttonNext;
		const mnemonicInputLabel = SCREEN_TEXT.inputMnemonicLabel;
		const accountName = DEFAULT_ACCOUNT_NAME;
		const screenTester = new ScreenTester(ImportWallet);

		// Act:
		screenTester.expectText(screenText);
		screenTester.inputText(mnemonicInputLabel, TEST_MNEMONIC);
		screenTester.pressButton(buttonNextText);
		await screenTester.waitForTimer();

		// Assert:
		expect(walletControllerMock.saveMnemonicAndGenerateAccounts).toHaveBeenCalledWith({
			mnemonic: TEST_MNEMONIC,
			name: accountName,
			accountPerNetworkCount: 10
		});
	});

	it('dismisses the keyboard before showing the passcode when the next button is pressed', async () => {
		// Arrange:
		const dismissKeyboardMock = jest.spyOn(PlatformUtils, 'dismissKeyboard').mockImplementation(() => {});
		mockPasscode();
		mockWalletController();
		const buttonNextText = SCREEN_TEXT.buttonNext;
		const mnemonicInputLabel = SCREEN_TEXT.inputMnemonicLabel;
		const screenTester = new ScreenTester(ImportWallet);

		// Act:
		screenTester.inputText(mnemonicInputLabel, TEST_MNEMONIC);
		screenTester.pressButton(buttonNextText);
		await screenTester.waitForTimer();

		// Assert:
		expect(dismissKeyboardMock).toHaveBeenCalledTimes(1);
	});

	runScreenNavigationTest(ImportWallet, {
		navigationActions: [
			{
				buttonText: SCREEN_TEXT.buttonCancel,
				actionName: 'goBack'
			}
		]
	});
});
