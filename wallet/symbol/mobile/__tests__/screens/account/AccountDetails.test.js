import { AccountDetails } from '@/app/screens/account/AccountDetails';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLink, mockLocalization, mockPasscode, mockWalletController } from '__tests__/mock-helpers';

// Mocks

jest.mock('@/app/lib/platform/PlatformUtils', () => ({
	PlatformUtils: {
		openLink: jest.fn(),
		getOS: jest.fn(() => 'android')
	}
}));

jest.mock('@/app/utils', () => ({
	...jest.requireActual('@/app/utils'),
	...require('__tests__/mock-factories').createAccountDisplayDataUtilsMock({}),
	createAccountAddressQr: jest.fn(() => ({})),
	createExplorerAccountUrl: jest.fn((chainName, networkIdentifier, address) =>
		`https://explorer.${chainName}.${networkIdentifier}/account/${address}`)
}));

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER_MAINNET = 'mainnet';
const NETWORK_IDENTIFIER_TESTNET = 'testnet';
const SYMBOL_FAUCET_BASE_URL = 'https://testnet.symbol.tools';
const NEM_FAUCET_BASE_URL = 'https://testnet.nem.tools';
const MOCK_PRIVATE_KEY = 'mockPrivateKey123';

// Screen Text

const SCREEN_TEXT = {
	// Table field titles
	textFieldAddress: 'fieldTitle_address',
	textFieldPublicKey: 'fieldTitle_publicKey',
	textFieldChainName: 'fieldTitle_chainName',
	textFieldNetworkIdentifier: 'fieldTitle_networkIdentifier',
	textFieldName: 'fieldTitle_name',
	textFieldAccountType: 'fieldTitle_accountType',
	textFieldSeedIndex: 'fieldTitle_seedIndex',
	textFieldMultisigAddresses: 'fieldTitle_multisigAddresses',

	// Buttons
	buttonFaucet: 'button_faucet',
	buttonFaucetXym: 'button_faucet XYM',
	buttonFaucetXem: 'button_faucet XEM',
	buttonOpenExplorer: 'button_openTransactionInExplorer',
	buttonRevealPrivateKey: 'button_revealPrivateKey',

	// Dialog
	dialogSensitiveTitle: 'dialog_sensitiveInformation_title'
};

// Account Fixtures

const mainnetSeedAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_MAINNET, 0)
	.build();

const mainnetMnemonicAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_MAINNET, 0)
	.setAccountType('mnemonic')
	.setSeedIndex(5)
	.build();

const mainnetPrivateKeyAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_MAINNET, 0)
	.setAccountType('privateKey')
	.build();

const testnetSeedAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_TESTNET, 0)
	.build();

const nemTestnetAccount = AccountFixtureBuilder
	.createWithData({
		address: 'TDQIZK6LUOYP7VXPZRLQKPW4Z2BZMSVAVY57C4VD',
		publicKey: 'F258E050E917F983C806EC3CB24409EC2417CA16D1AFF4E5A35A0813AFEB0820',
		name: 'Testnet Account 1',
		networkIdentifier: NETWORK_IDENTIFIER_TESTNET,
		accountType: 'mnemonic',
		index: 0
	})
	.build();

const multisigAccount1 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_MAINNET, 2)
	.build();

const multisigAccount2 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_MAINNET, 3)
	.build();

// Account Info Fixtures

const regularAccountInfo = AccountInfoFixtureBuilder
	.createEmpty(CHAIN_NAME, NETWORK_IDENTIFIER_MAINNET)
	.override({ multisigAddresses: [] })
	.build();

const multisigCosignerAccountInfo = AccountInfoFixtureBuilder
	.createEmpty(CHAIN_NAME, NETWORK_IDENTIFIER_MAINNET)
	.override({ multisigAddresses: [multisigAccount1.address, multisigAccount2.address] })
	.build();

// Wallet Controller Mock

const mockWalletControllerConfigured = (overrides = {}) => {
	return mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: overrides.networkIdentifier ?? NETWORK_IDENTIFIER_MAINNET,
		currentAccount: overrides.currentAccount ?? mainnetSeedAccount,
		currentAccountInfo: overrides.currentAccountInfo ?? regularAccountInfo,
		getCurrentAccountPrivateKey: jest.fn().mockResolvedValue(MOCK_PRIVATE_KEY),
		modules: {
			addressBook: {}
		},
		accounts: {
			mainnet: [],
			testnet: []
		},
		...overrides
	});
};

describe('screens/account/AccountDetails', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockLocalization();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders account details table with all required fields', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const expectedTexts = [
				SCREEN_TEXT.textFieldAddress,
				mainnetSeedAccount.address,
				SCREEN_TEXT.textFieldPublicKey,
				mainnetSeedAccount.publicKey,
				SCREEN_TEXT.textFieldChainName,
				CHAIN_NAME,
				SCREEN_TEXT.textFieldNetworkIdentifier,
				mainnetSeedAccount.networkIdentifier,
				SCREEN_TEXT.textFieldAccountType,
				mainnetSeedAccount.accountType
			];

			// Act:
			const screenTester = new ScreenTester(AccountDetails);

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		describe('seed index visibility', () => {
			const runSeedIndexTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					mockWalletControllerConfigured({
						currentAccount: config.currentAccount
					});

					// Act:
					const screenTester = new ScreenTester(AccountDetails);

					// Assert:
					if (expected.shouldRenderSeedIndex) {
						screenTester.expectText([
							SCREEN_TEXT.textFieldSeedIndex,
							expected.seedIndexValue
						]);
					} else {
						screenTester.notExpectText([SCREEN_TEXT.textFieldSeedIndex]);
					}
				});
			};

			const seedIndexTests = [
				{
					description: 'renders seed index for mnemonic accounts',
					config: { currentAccount: mainnetMnemonicAccount },
					expected: { shouldRenderSeedIndex: true, seedIndexValue: '5' }
				},
				{
					description: 'does not render seed index for non-mnemonic accounts',
					config: { currentAccount: mainnetPrivateKeyAccount },
					expected: { shouldRenderSeedIndex: false }
				}
			];

			seedIndexTests.forEach(test => {
				runSeedIndexTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('buttons', () => {
		describe('faucet button visibility', () => {
			const runFaucetButtonTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					mockWalletControllerConfigured({
						networkIdentifier: config.networkIdentifier,
						currentAccount: config.currentAccount
					});

					// Act:
					const screenTester = new ScreenTester(AccountDetails);

					// Assert:
					if (expected.shouldRenderFaucet)
						screenTester.expectText([SCREEN_TEXT.buttonFaucet]);
					else
						screenTester.notExpectText([SCREEN_TEXT.buttonFaucet]);
				});
			};

			const faucetButtonTests = [
				{
					description: 'shows faucet button on testnet',
					config: {
						networkIdentifier: NETWORK_IDENTIFIER_TESTNET,
						currentAccount: testnetSeedAccount
					},
					expected: { shouldRenderFaucet: true }
				},
				{
					description: 'hides faucet button on mainnet',
					config: {
						networkIdentifier: NETWORK_IDENTIFIER_MAINNET,
						currentAccount: mainnetSeedAccount
					},
					expected: { shouldRenderFaucet: false }
				}
			];

			faucetButtonTests.forEach(test => {
				runFaucetButtonTest(test.description, test.config, test.expected);
			});
		});

		describe('open block explorer', () => {
			it('opens block explorer when button is pressed', () => {
				// Arrange:
				const openLinkMock = mockLink();
				mockWalletControllerConfigured();
				const screenTester = new ScreenTester(AccountDetails);
				const expectedUrl = `https://explorer.${CHAIN_NAME}.${NETWORK_IDENTIFIER_MAINNET}/account/${mainnetSeedAccount.address}`;

				// Act:
				screenTester.pressButton(SCREEN_TEXT.buttonOpenExplorer);

				// Assert:
				expect(openLinkMock).toHaveBeenCalledWith(expectedUrl);
			});
		});

		describe('open faucet', () => {
			const runOpenFaucetTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					mockLocalization((key, params) => (params ? `${key} ${Object.values(params).join(' ')}` : key));
					const openLinkMock = mockLink();
					mockWalletControllerConfigured({
						chainName: config.chainName,
						ticker: config.ticker,
						networkIdentifier: NETWORK_IDENTIFIER_TESTNET,
						currentAccount: config.currentAccount
					});
					const screenTester = new ScreenTester(AccountDetails);

					// Act:
					screenTester.pressButton(expected.buttonText);

					// Assert:
					expect(openLinkMock).toHaveBeenCalledWith(expected.url);
				});
			};

			const openFaucetTests = [
				{
					description: 'opens Symbol faucet with XYM label when button is pressed on Symbol testnet',
					config: {
						chainName: 'symbol',
						ticker: 'XYM',
						currentAccount: testnetSeedAccount
					},
					expected: {
						buttonText: SCREEN_TEXT.buttonFaucetXym,
						url: `${SYMBOL_FAUCET_BASE_URL}/?recipient=${testnetSeedAccount.address}`
					}
				},
				{
					description: 'opens NEM faucet with XEM label when button is pressed on NEM testnet',
					config: {
						chainName: 'nem',
						ticker: 'XEM',
						currentAccount: nemTestnetAccount
					},
					expected: {
						buttonText: SCREEN_TEXT.buttonFaucetXem,
						url: `${NEM_FAUCET_BASE_URL}/?recipient=${nemTestnetAccount.address}`
					}
				}
			];

			openFaucetTests.forEach(test => {
				runOpenFaucetTest(test.description, test.config, test.expected);
			});
		});

		describe('reveal private key', () => {
			it('reveals private key after passcode verification', async () => {
				// Arrange:
				const walletControllerMock = mockWalletControllerConfigured();
				mockPasscode();
				const screenTester = new ScreenTester(AccountDetails);

				// Act:
				screenTester.pressButton(SCREEN_TEXT.buttonRevealPrivateKey);
				await screenTester.waitForTimer();

				// Assert:
				expect(walletControllerMock.getCurrentAccountPrivateKey).toHaveBeenCalled();
				screenTester.expectText([MOCK_PRIVATE_KEY, SCREEN_TEXT.dialogSensitiveTitle]);
			});
		});
	});

	describe('multisig accounts', () => {
		it('renders multisig addresses when account is multisig cosigner', () => {
			// Arrange:
			mockWalletControllerConfigured({
				currentAccountInfo: multisigCosignerAccountInfo
			});
			const expectedTexts = [
				SCREEN_TEXT.textFieldMultisigAddresses,
				multisigAccount1.address,
				multisigAccount2.address
			];

			// Act:
			const screenTester = new ScreenTester(AccountDetails);

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('does not render multisig section when account has no multisig addresses', () => {
			// Arrange:
			mockWalletControllerConfigured({
				currentAccountInfo: regularAccountInfo
			});

			// Act:
			const screenTester = new ScreenTester(AccountDetails);

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textFieldMultisigAddresses]);
		});
	});
});
