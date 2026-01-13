import { ImportWallet } from '@/app/screens/onboarding/ImportWallet';
import * as optinModule from '@/app/screens/onboarding/utils/optin';
import { mnemonic } from '__fixtures__/local/wallet';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockWalletController } from '__tests__/mock-helpers';
import { runScreenNavigationTest } from '__tests__/screen-tests';

const TEST_MNEMONIC = mnemonic;

describe('screens/onboarding/ImportWallet', () => {
	beforeEach(() => {
		mockLocalization();
	});

	it('import wallet flow', async () => {
		// Arrange:
		jest.spyOn(optinModule, 'getOptinAccountFromMnemonic').mockResolvedValue(null);
		mockPasscode();
		const walletControllerMock = mockWalletController();
		const screenText = [
			's_importWallet_title',
			's_importWallet_text'
		];
		const buttonNextText = 'button_next';
		const mnemonicInputLabel = 'input_mnemonic';
		const accountName = 's_importWallet_defaultAccountName';
		const screenTester = new ScreenTester(ImportWallet);

		// Act:
		screenTester.expectText(screenText);
		screenTester.inputText(mnemonicInputLabel, TEST_MNEMONIC);
		screenTester.pressButton(buttonNextText);
		await screenTester.waitForTimer();
		await screenTester.waitForTimer();

		// Assert:
		expect(walletControllerMock.saveMnemonicAndGenerateAccounts).toHaveBeenCalledWith({
			mnemonic: TEST_MNEMONIC,
			name: accountName
		});
	});

	runScreenNavigationTest(ImportWallet, {
		navigationActions: [
			{
				buttonText: 'button_cancel',
				actionName: 'goBack'
			}
		]
	});
});
