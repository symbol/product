import { NetworkIdentifier } from '@/app/constants';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { ImportWallet } from '@/app/screens/onboarding/ImportWallet';
import * as optinModule from '@/app/screens/onboarding/utils/optin';
import { mnemonic } from '__fixtures__/local/wallet';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockWalletController } from '__tests__/mock-helpers';
import { runScreenNavigationTest } from '__tests__/screen-tests';
import * as walletCommonSymbolModule from 'wallet-common-symbol';

jest.mock('@/app/config', () => {
	const original = jest.requireActual('@/app/config');
	return {
		...original,
		optInPublicKeys: [
			'A5F900591244C3F0054F5AB0684D351296D695CDCD6526189913D7C5D76C449E',
			'99EBD6C70732A1387693C9890F3B0830B547FA70FE644E396E8FD6993172E8A5'
		]
	};
});

jest.mock('wallet-common-symbol', () => {
	const original = jest.requireActual('wallet-common-symbol');
	return {
		...original,
		__esModule: true
	};
});

const TEST_MNEMONIC = mnemonic;
const DEFAULT_ACCOUNT_NAME = 's_importWallet_defaultAccountName';
const OPT_IN_ACCOUNT_NAME = 'Opt-in Account';

const optInAccount = {
	publicKey: 'A5F900591244C3F0054F5AB0684D351296D695CDCD6526189913D7C5D76C449E',
	privateKey: 'E8F32E723DECF4051AEFAC8E2C93C9C5B214313817CDB01A1494B917C8436B35'
};

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
		jest.spyOn(optinModule, 'getOptinAccountFromMnemonic').mockResolvedValue(null);
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
		await screenTester.waitForTimer();

		// Assert:
		expect(walletControllerMock.saveMnemonicAndGenerateAccounts).toHaveBeenCalledWith({
			mnemonic: TEST_MNEMONIC,
			name: accountName,
			accountPerNetworkCount: 10
		});
		expect(walletControllerMock.addExternalAccount).not.toHaveBeenCalled();
	});

	it('adds the opt-in account as an external account when the mnemonic is in the opt-in list', async () => {
		// Arrange:
		jest.spyOn(optinModule, 'getOptinAccountFromMnemonic').mockResolvedValue(optInAccount);
		mockPasscode();
		const walletControllerMock = mockWalletController();
		const buttonNextText = SCREEN_TEXT.buttonNext;
		const mnemonicInputLabel = SCREEN_TEXT.inputMnemonicLabel;
		const accountName = DEFAULT_ACCOUNT_NAME;
		const screenTester = new ScreenTester(ImportWallet);

		// Act:
		screenTester.inputText(mnemonicInputLabel, TEST_MNEMONIC);
		screenTester.pressButton(buttonNextText);
		await screenTester.waitForTimer();
		await screenTester.waitForTimer();

		// Assert:
		expect(walletControllerMock.saveMnemonicAndGenerateAccounts).toHaveBeenCalledWith({
			mnemonic: TEST_MNEMONIC,
			name: accountName,
			accountPerNetworkCount: 10
		});
		expect(walletControllerMock.addExternalAccount).toHaveBeenCalledWith({
			privateKey: optInAccount.privateKey,
			name: OPT_IN_ACCOUNT_NAME,
			networkIdentifier: NetworkIdentifier.MAIN_NET
		});
	});

	it('dismisses the keyboard before showing the passcode when the next button is pressed', async () => {
		// Arrange:
		jest.spyOn(optinModule, 'getOptinAccountFromMnemonic').mockResolvedValue(null);
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

	describe('opt-in account check', () => {
		const runOptInTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const createOptInPrivateKeyFromMnemonicMock = jest
					.spyOn(walletCommonSymbolModule, 'createOptInPrivateKeyFromMnemonic')
					.mockReturnValue(config.privateKey);
				const createPrivateAccountMock = jest
					.spyOn(walletCommonSymbolModule, 'createPrivateAccount')
					.mockReturnValue(config.account);

				// Act:
				const result = optinModule.getOptinAccountFromMnemonic(TEST_MNEMONIC);

				// Assert:
				expect(result).toEqual(expected.result);
				expect(createOptInPrivateKeyFromMnemonicMock).toHaveBeenCalledWith(TEST_MNEMONIC);
				expect(createPrivateAccountMock).toHaveBeenCalledWith(
					config.privateKey, 
					walletCommonSymbolModule.constants.NetworkIdentifier.MAIN_NET
				);
			});
		};

		const tests = [
			{
				description: 'returns account when public key is in opt-in list',
				config: {
					privateKey: 'mockPrivateKey1',
					account: { publicKey: 'A5F900591244C3F0054F5AB0684D351296D695CDCD6526189913D7C5D76C449E' }
				},
				expected: {
					result: { publicKey: 'A5F900591244C3F0054F5AB0684D351296D695CDCD6526189913D7C5D76C449E' }
				}
			},
			{
				description: 'returns null when public key is not in opt-in list',
				config: {
					privateKey: 'mockPrivateKey2',
					account: { publicKey: '0000000000000000000000000000000000000000000000000000000000000000' }
				},
				expected: {
					result: null
				}
			}
		];

		tests.forEach(test => {
			runOptInTest(test.description, test.config, test.expected);
		});
	});
});
