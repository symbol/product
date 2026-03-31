import { config } from '@/app/config';
import { MultisigAccountDetails } from '@/app/screens/multisig/MultisigAccountDetails';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { ContactFixtureBuilder } from '__fixtures__/local/ContactFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createAddressBookMock, mockLink, mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const MIN_APPROVAL = 2;
const MIN_REMOVAL = 3;
const COSIGNATORY_COUNT = 4;

// Explorer URL

const EXPLORER_BASE_URL = config.chains[CHAIN_NAME].explorerURL[NETWORK_IDENTIFIER];

// Screen Text

const SCREEN_TEXT = {
	textFieldChainName: 'fieldTitle_chainName',
	textFieldAddress: 'fieldTitle_address',
	textFieldMinApprovals: 'fieldTitle_minApprovals',
	textFieldMinRemovals: 'fieldTitle_minRemovals',
	textFieldCosignatories: 'fieldTitle_accountCosignatories',
	textTokensTitle: 's_multisig_tokens_title',
	textDefaultAccountName: 's_multisig_defaultAccountName',
	textEmptyList: 'message_emptyList',
	buttonSendTransaction: 'button_sendTransactionFromThisAccount',
	buttonOpenExplorer: 'button_openTransactionInExplorer',
	buttonModifyAccount: 'button_modifyAccount'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const walletAccount1 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const walletAccount2 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.build();

const walletAccount3 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.build();

const walletAccount4 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 4)
	.build();

// Contact Fixtures

const contactForMultisig = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setName('Multisig Contact')
	.build();

// Token Fixtures

const tokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('1000000000')
	.build();

const tokenCustom = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setAmount('500')
	.build();

// Token display names (as shown in UI with ticker)
const TOKEN_DISPLAY_NAME_XYM = 'Symbol • XYM';
const TOKEN_DISPLAY_NAME_CUSTOM = tokenCustom.name;

// Multisig Account Info Fixtures

const multisigAccountInfoBase = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setMinApproval(MIN_APPROVAL)
	.setMinRemoval(MIN_REMOVAL)
	.setMultisigStatusByIndexes(true, [0, 2, 3, 4])
	.build();

// Multisig account without wallet account name (external address)
const EXTERNAL_MULTISIG_ADDRESS = 'TBEXT4ERNALMULTISIGADDRESSNOTINWALL';

const multisigAccountInfoExternal = AccountInfoFixtureBuilder
	.createEmpty(CHAIN_NAME, NETWORK_IDENTIFIER)
	.override({
		address: EXTERNAL_MULTISIG_ADDRESS,
		publicKey: '0000000000000000000000000000000000000000000000000000000000000000',
		isMultisig: true,
		cosignatories: [
			currentAccount.address,
			walletAccount2.address,
			walletAccount3.address,
			walletAccount4.address
		],
		minApproval: MIN_APPROVAL,
		minRemoval: MIN_REMOVAL
	})
	.build();

const multisigAccountInfoWithTokens = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setMinApproval(MIN_APPROVAL)
	.setMinRemoval(MIN_REMOVAL)
	.setMultisigStatusByIndexes(true, [0, 2, 3, 4])
	.setTokens([tokenXym, tokenCustom])
	.build();

const multisigAccountInfoWithoutTokens = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setMinApproval(MIN_APPROVAL)
	.setMinRemoval(MIN_REMOVAL)
	.setMultisigStatusByIndexes(true, [0, 2, 3, 4])
	.setTokens([])
	.build();

// Mock Factory

const createMultisigModuleMock = (accountInfo = multisigAccountInfoBase) => ({
	fetchAccountInfo: jest.fn().mockResolvedValue(accountInfo)
});

// Route Props Factory

const createRouteProps = (accountAddress, preloadedData = null) => ({
	route: {
		params: {
			chainName: CHAIN_NAME,
			accountAddress,
			preloadedData
		}
	}
});

// Setup

const setupMocks = (config = {}) => {
	const {
		multisigAccountInfo = multisigAccountInfoBase,
		contacts = [],
		walletAccounts = [currentAccount, walletAccount1, walletAccount2, walletAccount3, walletAccount4]
	} = config;

	mockLocalization();
	const routerMock = mockRouter({
		goToSend: jest.fn(),
		goToModifyMultisigAccount: jest.fn(),
		goToTokenDetails: jest.fn()
	});
	const addressBookMock = createAddressBookMock(contacts);
	const multisigModuleMock = createMultisigModuleMock(multisigAccountInfo);
	const walletControllerMock = mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		currentAccount,
		accounts: {
			[NETWORK_IDENTIFIER]: walletAccounts
		},
		modules: {
			addressBook: addressBookMock,
			multisig: multisigModuleMock
		}
	});

	return {
		walletController: walletControllerMock,
		addressBook: addressBookMock,
		router: routerMock,
		multisigModule: multisigModuleMock
	};
};

describe('screens/multisig/MultisigAccountDetails', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders screen text with field titles and action buttons', async () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.textFieldChainName,
				SCREEN_TEXT.textFieldAddress,
				SCREEN_TEXT.textFieldMinApprovals,
				SCREEN_TEXT.textFieldMinRemovals,
				SCREEN_TEXT.textFieldCosignatories,
				SCREEN_TEXT.textTokensTitle,
				SCREEN_TEXT.buttonSendTransaction,
				SCREEN_TEXT.buttonOpenExplorer,
				SCREEN_TEXT.buttonModifyAccount
			];

			// Act:
			const screenTester = new ScreenTester(
				MultisigAccountDetails,
				createRouteProps(multisigAccountInfoBase.address, multisigAccountInfoBase)
			);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('account info', () => {
		const runAccountInfoTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks({
					multisigAccountInfo: config.multisigAccountInfo,
					contacts: config.contacts
				});

				// Act:
				const screenTester = new ScreenTester(
					MultisigAccountDetails,
					createRouteProps(config.multisigAccountInfo.address, config.multisigAccountInfo)
				);
				await screenTester.waitForTimer();

				// Assert:
				screenTester.expectText([
					expected.accountName,
					CHAIN_NAME,
					config.multisigAccountInfo.address
				]);
			});
		};

		const accountInfoTests = [
			{
				description: 'renders contact name, chain name and address when contact exists in address book',
				config: {
					multisigAccountInfo: multisigAccountInfoBase,
					contacts: [contactForMultisig]
				},
				expected: {
					accountName: contactForMultisig.name
				}
			},
			{
				description: 'renders default name, chain name and address when contact does not exist in address book',
				config: {
					multisigAccountInfo: multisigAccountInfoExternal,
					contacts: []
				},
				expected: {
					accountName: SCREEN_TEXT.textDefaultAccountName
				}
			}
		];

		accountInfoTests.forEach(test => {
			runAccountInfoTest(test.description, test.config, test.expected);
		});
	});

	describe('multisig info', () => {
		it('renders min approval, min removal and cosignatory addresses', async () => {
			// Arrange:
			setupMocks({
				multisigAccountInfo: multisigAccountInfoBase
			});
			const minApprovalText = `${MIN_APPROVAL} of ${COSIGNATORY_COUNT}`;
			const minRemovalText = `${MIN_REMOVAL} of ${COSIGNATORY_COUNT}`;
			const cosignatoryAddresses = multisigAccountInfoBase.cosignatories;

			// Act:
			const screenTester = new ScreenTester(
				MultisigAccountDetails,
				createRouteProps(multisigAccountInfoBase.address, multisigAccountInfoBase)
			);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([minApprovalText, minRemovalText]);
			screenTester.expectText(cosignatoryAddresses);
		});
	});

	describe('tokens list', () => {
		const runTokensListTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks({
					multisigAccountInfo: config.multisigAccountInfo
				});

				// Act:
				const screenTester = new ScreenTester(
					MultisigAccountDetails,
					createRouteProps(config.multisigAccountInfo.address, config.multisigAccountInfo)
				);
				await screenTester.waitForTimer();

				// Assert:
				if (expected.tokenNames) 
					screenTester.expectText(expected.tokenNames);
				
				if (expected.emptyMessage) 
					screenTester.expectText([expected.emptyMessage]);
				else 
					screenTester.notExpectText([SCREEN_TEXT.textEmptyList]);
				
			});
		};

		const tokensListTests = [
			{
				description: 'renders tokens with names when account has tokens',
				config: {
					multisigAccountInfo: multisigAccountInfoWithTokens
				},
				expected: {
					tokenNames: [TOKEN_DISPLAY_NAME_XYM, TOKEN_DISPLAY_NAME_CUSTOM],
					emptyMessage: null
				}
			},
			{
				description: 'renders empty list message when account has no tokens',
				config: {
					multisigAccountInfo: multisigAccountInfoWithoutTokens
				},
				expected: {
					tokenNames: null,
					emptyMessage: SCREEN_TEXT.textEmptyList
				}
			}
		];

		tokensListTests.forEach(test => {
			runTokensListTest(test.description, test.config, test.expected);
		});
	});

	describe('navigation', () => {
		const runNavigationTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const { router: routerMock } = setupMocks({
					multisigAccountInfo: config.multisigAccountInfo
				});
				const openLinkMock = config.mockOpenLink ? mockLink() : null;
				const screenTester = new ScreenTester(
					MultisigAccountDetails,
					createRouteProps(config.multisigAccountInfo.address, config.multisigAccountInfo)
				);
				await screenTester.waitForTimer();

				// Act:
				screenTester.pressButton(config.buttonText);

				// Assert:
				if (expected.routerMethod) 
					expect(routerMock[expected.routerMethod]).toHaveBeenCalledWith(expected.params);
				
				if (expected.externalUrl) 
					expect(openLinkMock).toHaveBeenCalledWith(expected.externalUrl);
				
			});
		};

		const navigationTests = [
			{
				description: 'navigates to Send screen when send button is pressed',
				config: {
					multisigAccountInfo: multisigAccountInfoBase,
					buttonText: SCREEN_TEXT.buttonSendTransaction,
					mockOpenLink: false
				},
				expected: {
					routerMethod: 'goToSend',
					params: {
						params: {
							chainName: CHAIN_NAME,
							senderAddress: multisigAccountInfoBase.address
						}
					}
				}
			},
			{
				description: 'opens block explorer when explorer button is pressed',
				config: {
					multisigAccountInfo: multisigAccountInfoBase,
					buttonText: SCREEN_TEXT.buttonOpenExplorer,
					mockOpenLink: true
				},
				expected: {
					externalUrl: `${EXPLORER_BASE_URL}/accounts/${multisigAccountInfoBase.address}`
				}
			},
			{
				description: 'navigates to ModifyMultisigAccount screen when modify button is pressed',
				config: {
					multisigAccountInfo: multisigAccountInfoBase,
					buttonText: SCREEN_TEXT.buttonModifyAccount,
					mockOpenLink: false
				},
				expected: {
					routerMethod: 'goToModifyMultisigAccount',
					params: {
						params: {
							chainName: CHAIN_NAME,
							accountAddress: multisigAccountInfoBase.address,
							preloadedData: multisigAccountInfoBase
						}
					}
				}
			}
		];

		navigationTests.forEach(test => {
			runNavigationTest(test.description, test.config, test.expected);
		});
	});
});
