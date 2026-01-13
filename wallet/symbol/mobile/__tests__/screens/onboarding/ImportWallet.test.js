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
			name: accountName,
			accountPerNetworkCount: 10
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

	describe('opt-in account', () => {
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
