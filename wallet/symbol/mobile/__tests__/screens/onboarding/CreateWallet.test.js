import { CreateWallet } from '@/app/screens/onboarding/CreateWallet';
import * as mnemonicModule from '@/app/screens/onboarding/utils/mnemonic';
import { mnemonic } from '__fixtures__/local/wallet';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockWalletController } from '__tests__/mock-helpers';
import { runScreenNavigationTest } from '__tests__/screen-tests';

const TEST_MNEMONIC = mnemonic;
const SCREEN_TEXT = {
	textAccountNameTitle: 's_createWallet_accountName_title',
	textAccountNameDescription: 's_createWallet_accountName_text',
	inputAccountNameLabel: 's_createWallet_accountName_input',
	textMnemonicTitle: 's_createWallet_mnemonic_title',
	textMnemonicDescriptionParagraph1: 's_createWallet_mnemonic_text_p1',
	textMnemonicDescriptionParagraph2: 's_createWallet_mnemonic_text_p2',
	textMnemonicDescriptionParagraph3: 's_createWallet_mnemonic_text_p3',
	textTipsTitle: 's_createWallet_tips_title',
	textTipsParagraph1: 's_createWallet_tips_text_p1',
	textTipsParagraph2: 's_createWallet_tips_text_p2',
	textConfirmTitle: 's_createWallet_confirm_title',
	checkboxAcceptRiskText: 's_createWallet_confirm_checkbox',
	buttonNext: 'button_next',
	buttonCancel: 'button_cancel'
};

describe('screens/onboarding/CreateWallet', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockLocalization();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	it('create wallet flow', async () => {
		// Arrange:
		jest.spyOn(mnemonicModule, 'generateMnemonic').mockReturnValue(TEST_MNEMONIC);
		const walletControllerMock = mockWalletController();
		mockPasscode();

		const step1ExpectedText = [
			SCREEN_TEXT.textAccountNameTitle,
			SCREEN_TEXT.textAccountNameDescription,
			SCREEN_TEXT.inputAccountNameLabel
		];
		const step2ExpectedText = [
			SCREEN_TEXT.textMnemonicTitle,
			SCREEN_TEXT.textMnemonicDescriptionParagraph1,
			SCREEN_TEXT.textMnemonicDescriptionParagraph2,
			SCREEN_TEXT.textMnemonicDescriptionParagraph3,
			SCREEN_TEXT.textTipsTitle,
			SCREEN_TEXT.textTipsParagraph1,
			SCREEN_TEXT.textTipsParagraph2,
			SCREEN_TEXT.textConfirmTitle,
			SCREEN_TEXT.checkboxAcceptRiskText
		];
		const accountNameInputLabel = SCREEN_TEXT.inputAccountNameLabel;
		const acceptRiskCheckboxText = SCREEN_TEXT.checkboxAcceptRiskText;
		const accountName = 'My Wallet';
		const screenTester = new ScreenTester(CreateWallet);

		// Act - Step 1: Enter account name
		screenTester.notExpectText(step2ExpectedText);
		screenTester.expectText(step1ExpectedText);
		screenTester.inputText(accountNameInputLabel, accountName);
		screenTester.pressButton(SCREEN_TEXT.buttonNext);

		// Act - Step 2: Accept risk and submit
		screenTester.notExpectText(step1ExpectedText);
		screenTester.expectText(step2ExpectedText);
		screenTester.pressButton(acceptRiskCheckboxText);
		screenTester.pressButton(SCREEN_TEXT.buttonNext);
		await screenTester.waitForTimer();

		// Assert:
		expect(walletControllerMock.saveMnemonicAndGenerateAccounts).toHaveBeenCalledWith({
			mnemonic: TEST_MNEMONIC,
			name: accountName,
			accountPerNetworkCount: 10
		});
	});

	runScreenNavigationTest(CreateWallet, {
		navigationActions: [
			{
				buttonText: SCREEN_TEXT.buttonCancel,
				actionName: 'goBack'
			}
		]
	});
});
