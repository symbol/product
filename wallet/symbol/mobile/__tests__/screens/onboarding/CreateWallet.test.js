import { CreateWallet } from '@/app/screens/onboarding/CreateWallet';
import * as mnemonicModule from '@/app/screens/onboarding/utils/mnemonic';
import { mnemonic } from '__fixtures__/local/wallet';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockWalletController } from '__tests__/mock-helpers';
import { runScreenNavigationTest } from '__tests__/screen-tests';

const TEST_MNEMONIC = mnemonic;

describe('screens/onboarding/CreateWallet', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		mockLocalization();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('create wallet flow', async () => {
		// Arrange:
		jest.spyOn(mnemonicModule, 'generateMnemonic').mockReturnValue(TEST_MNEMONIC);
		const walletControllerMock = mockWalletController();
		mockPasscode();

		const step1ExpectedText = [
			's_createWallet_accountName_title',
			's_createWallet_accountName_text',
			's_createWallet_accountName_input'
		];
		const step2ExpectedText = [
			's_createWallet_mnemonic_title',
			's_createWallet_mnemonic_text_p1',
			's_createWallet_mnemonic_text_p2',
			's_createWallet_mnemonic_text_p3',
			's_createWallet_tips_title',
			's_createWallet_tips_text_p1',
			's_createWallet_tips_text_p2',
			's_createWallet_confirm_title',
			's_createWallet_confirm_checkbox'
		];
		const accountNameInputLabel = 's_createWallet_accountName_input';
		const buttonNextText = 'button_next';
		const acceptRiskCheckboxText = 's_createWallet_confirm_checkbox';
		const accountName = 'My Wallet';
		const screenTester = new ScreenTester(CreateWallet);

		// Act - Step 1: Enter account name
		screenTester.notExpectText(step2ExpectedText);
		screenTester.expectText(step1ExpectedText);
		screenTester.inputText(accountNameInputLabel, accountName);
		screenTester.pressButton(buttonNextText);

		// Act - Step 2: Accept risk and submit
		screenTester.notExpectText(step1ExpectedText);
		screenTester.expectText(step2ExpectedText);
		screenTester.pressButton(acceptRiskCheckboxText);
		screenTester.pressButton(buttonNextText);
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
				buttonText: 'button_cancel',
				actionName: 'goBack'
			}
		]
	});
});
