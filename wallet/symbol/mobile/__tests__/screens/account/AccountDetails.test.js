import { AccountDetails } from '@/app/screens/account/AccountDetails';
import { walletStorageAccounts } from '__fixtures__/local/wallet';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLink, mockLocalization, mockPasscode, mockWalletController } from '__tests__/mock-helpers';

jest.mock('@/app/lib/platform/PlatformUtils', () => ({
	PlatformUtils: {
		openLink: jest.fn(),
		getOS: jest.fn(() => 'android')
	}
}));

jest.mock('@/app/utils', () => ({
	createExplorerAccountUrl: jest.fn((chainName, networkIdentifier, address) =>
		`https://explorer.${chainName}.${networkIdentifier}/account/${address}`),
	getAccountKnownInfo: jest.fn(() => null)
}));

jest.mock('@/app/config', () => {
	const original = jest.requireActual('@/app/config');
	return {
		...original,
		config: {
			...original.config,
			faucetURL: 'https://faucet.symbol.testnet'
		}
	};
});

describe('screens/account/AccountDetails', () => {
	const createMockCurrentAccount = (overrides = {}) => ({
		...walletStorageAccounts.mainnet[0],
		...overrides
	});

	const createMockCurrentAccountInfo = (overrides = {}) => ({
		multisigAddresses: [],
		...overrides
	});

	const createMockWalletController = (overrides = {}) => ({
		chainName: 'symbol',
		networkIdentifier: 'mainnet',
		currentAccount: createMockCurrentAccount(overrides.currentAccount),
		currentAccountInfo: createMockCurrentAccountInfo(overrides.currentAccountInfo),
		getCurrentAccountPrivateKey: jest.fn().mockResolvedValue('mockPrivateKey123'),
		modules: {
			addressBook: {}
		},
		accounts: {
			mainnet: [],
			testnet: []
		},
		...overrides
	});

	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	describe('render', () => {
		const runAccountTableDataTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockWalletController(createMockWalletController(config.walletController));

				// Act:
				const screenTester = new ScreenTester(AccountDetails);

				// Assert:
				screenTester.expectText(expected.textsToRender);
				
				if (expected.textsNotToRender)
					screenTester.notExpectText(expected.textsNotToRender);
			});
		};

		const tests = [
			{
				description: 'renders account details table with address, publicKey, chainName, networkIdentifier, name, accountType',
				config: {
					walletController: {}
				},
				expected: {
					textsToRender: [
						'fieldTitle_address',
						walletStorageAccounts.mainnet[0].address,
						'fieldTitle_publicKey',
						walletStorageAccounts.mainnet[0].publicKey,
						'fieldTitle_chainName',
						'symbol',
						'fieldTitle_networkIdentifier',
						walletStorageAccounts.mainnet[0].networkIdentifier,
						'fieldTitle_name',
						walletStorageAccounts.mainnet[0].name,
						'fieldTitle_accountType',
						walletStorageAccounts.mainnet[0].accountType
					]
				}
			},
			{
				description: 'renders seed index for mnemonic accounts',
				config: {
					walletController: {
						currentAccount: {
							accountType: 'mnemonic',
							index: 5
						}
					}
				},
				expected: {
					textsToRender: [
						'fieldTitle_seedIndex',
						'5'
					]
				}
			},
			{
				description: 'does not render seed index for non-mnemonic accounts',
				config: {
					walletController: {
						currentAccount: {
							accountType: 'privateKey'
						}
					}
				},
				expected: {
					textsToRender: ['fieldTitle_accountType', 'privateKey'],
					textsNotToRender: ['fieldTitle_seedIndex']
				}
			}
		];

		tests.forEach(test => {
			runAccountTableDataTest(test.description, test.config, test.expected);
		});
	});

	describe('buttons', () => {
		describe('testnet buttons', () => {
			const runTestnetButtonTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const overrides = { 
						networkIdentifier: config.networkIdentifier,
						currentAccount: walletStorageAccounts[config.networkIdentifier][0]
					};
					mockWalletController(createMockWalletController(overrides));

					// Act:
					const screenTester = new ScreenTester(AccountDetails);

					// Assert:
					if (expected.shouldRenderFaucet)
						screenTester.expectText(['button_faucet']);
					else
						screenTester.notExpectText(['button_faucet']);
				});
			};

			const tests = [
				{
					description: 'shows faucet button on testnet',
					config: { networkIdentifier: 'testnet' },
					expected: { shouldRenderFaucet: true }
				},
				{
					description: 'hides faucet button on mainnet',
					config: { networkIdentifier: 'mainnet' },
					expected: { shouldRenderFaucet: false }
				}
			];

			tests.forEach(test => {
				runTestnetButtonTest(test.description, test.config, test.expected);
			});
		});

		describe('open block explorer', () => {
			it('opens block explorer when button is pressed', () => {
				// Arrange:
				const openLinkMock = mockLink();
				mockWalletController(createMockWalletController());
				const screenTester = new ScreenTester(AccountDetails);
				const expectedUrl = `https://explorer.symbol.mainnet/account/${walletStorageAccounts.mainnet[0].address}`;

				// Act:
				screenTester.pressButton('button_openTransactionInExplorer');

				// Assert:
				expect(openLinkMock).toHaveBeenCalledWith(expectedUrl);
			});
		});

		describe('open faucet', () => {
			it('opens faucet when button is pressed on testnet', () => {
				// Arrange:
				const openLinkMock = mockLink();
				mockWalletController(createMockWalletController({
					networkIdentifier: 'testnet',
					currentAccount: walletStorageAccounts.testnet[0]
				}));
				const screenTester = new ScreenTester(AccountDetails);
				const expectedUrl = `https://faucet.symbol.testnet/?recipient=${walletStorageAccounts.testnet[0].address}`;

				// Act:
				screenTester.pressButton('button_faucet');

				// Assert:
				expect(openLinkMock).toHaveBeenCalledWith(expectedUrl);
			});
		});

		describe('reveal private key', () => {
			it('reveals private key after passcode verification', async () => {
				// Arrange:
				const privateKey = 'mockPrivateKey123';
				const walletControllerMock = createMockWalletController();
				walletControllerMock.getCurrentAccountPrivateKey = jest.fn().mockResolvedValue(privateKey);
				mockWalletController(walletControllerMock);
				mockPasscode();
				const screenTester = new ScreenTester(AccountDetails);

				// Act:
				screenTester.pressButton('button_revealPrivateKey');
				await screenTester.waitForTimer();

				// Assert:
				expect(walletControllerMock.getCurrentAccountPrivateKey).toHaveBeenCalled();
				screenTester.expectText([privateKey, 'dialog_sensitive']);
			});
		});
	});

	describe('multisig accounts', () => {
		it('renders multisig addresses when account is multisig cosigner', () => {
			// Arrange:
			const multisigAddresses = [walletStorageAccounts.mainnet[2].address, walletStorageAccounts.mainnet[3].address];
			mockWalletController(createMockWalletController({
				currentAccountInfo: { multisigAddresses }
			}));
			const expectedTableText = [
				'fieldTitle_multisigAddresses',
				walletStorageAccounts.mainnet[2].address,
				walletStorageAccounts.mainnet[3].address
			];

			// Act:
			const screenTester = new ScreenTester(AccountDetails);

			// Assert:
			screenTester.expectText(expectedTableText);
		});

		it('does not render multisig section when account has no multisig addresses', () => {
			// Arrange:
			mockWalletController(createMockWalletController({
				currentAccountInfo: { multisigAddresses: [] }
			}));

			// Act:
			const screenTester = new ScreenTester(AccountDetails);

			// Assert:
			screenTester.notExpectText(['fieldTitle_multisigAddresses']);
		});
	});
});
