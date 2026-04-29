import { ShareAccountAddressUri, ShareTransferTransactionUri } from '@/app/lib/transport';
import { TransportRequest } from '@/app/screens/transport/TransportRequest';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Mocks

jest.mock('@/app/screens/transport/hooks', () => ({
	useSupportedChains: jest.fn()
}));

// Constants

const CHAIN_NAME = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const TRANSFER_AMOUNT = '1000000';
const INVALID_URI = 'not-a-valid-transport-uri';
const SYMBOL_TESTNET_GENERATION_HASH = '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4';
const DIFFERENT_CHAIN_ID = '57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6';

// Screen Text

const SCREEN_TEXT = {
	// Request details section
	textShareTitle: 's_transportRequest_details_share_title',
	textShareDescription: 's_transportRequest_details_share_description',

	// Actions section
	textSuggestedActionsGroup: 's_transportRequest_suggestedActions_group',
	textOtherActionsGroup: 's_transportRequest_otherActions_group',

	// Action item titles and descriptions
	textAddContactTitle: 's_transportRequest_action_addContact_title',
	textAddContactDescription: 's_transportRequest_action_addContact_description',
	textFillTransferFormTitle: 's_transportRequest_action_fillTransferForm_title',
	textFillTransferFormDescription: 's_transportRequest_action_fillTransferForm_description',
	textFillTransferFormOnlyAddressDescription: 's_transportRequest_action_fillTransferFormOnlyAddress_description',

	// Alert messages
	alertParseError: 's_transportRequest_alert_parseError_text',
	alertUnsupportedChain: 's_transportRequest_alert_chainNameSupport_text',
	alertInactiveChain: 's_transportRequest_alert_chainNameActive_text',
	alertNetworkMismatch: 's_transportRequest_alert_networkIdentifierMismatch_text',
	alertChainIdMismatch: 's_transportRequest_alert_chainIdMismatch_text'
};

// Account Fixtures

const symbolAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const symbolRecipientAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const ethereumAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.build();

// Network Properties Fixtures

const symbolNetworkPropertiesWithChainId = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.override({ generationHash: SYMBOL_TESTNET_GENERATION_HASH })
	.build();

// Token Fixtures

const xymToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount(TRANSFER_AMOUNT)
	.build();

// Transport URI Fixtures

const symbolAccountAddressUri = new ShareAccountAddressUri({
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	address: symbolAccount.address,
	name: symbolAccount.name
});

const symbolAccountAddressUriWithChainId = new ShareAccountAddressUri({
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	address: symbolAccount.address,
	name: symbolAccount.name,
	chainId: DIFFERENT_CHAIN_ID
});

const symbolTransferTransactionUri = new ShareTransferTransactionUri({
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	recipientAddress: symbolRecipientAccount.address,
	tokenId: xymToken.id,
	amount: TRANSFER_AMOUNT
});

const ethereumAccountAddressUri = new ShareAccountAddressUri({
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	address: ethereumAccount.address,
	name: ethereumAccount.name
});

const symbolMainnetAccountAddressUri = new ShareAccountAddressUri({
	chainName: CHAIN_NAME,
	networkIdentifier: 'mainnet',
	address: symbolAccount.address,
	name: symbolAccount.name
});

// Route Props Factory

const createRouteProps = transportUri => ({
	route: { params: { transportUri } }
});

// Navigation Factory

const createNavigation = (method, params) => ({ method, params: { params } });

// Mock Helpers

const mockSupportedChains = (overrides = {}) => {
	const { useSupportedChains } = require('@/app/screens/transport/hooks');
	useSupportedChains.mockReturnValue({
		supported: overrides.supported ?? [CHAIN_NAME],
		active: overrides.active ?? [CHAIN_NAME]
	});
};

// Config Presets

const symbolWalletConfig = {
	chainName: CHAIN_NAME,
	currentAccount: symbolAccount,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: symbolNetworkPropertiesWithChainId
};

const ethereumActiveWalletConfig = {
	...symbolWalletConfig,
	chainName: CHAIN_NAME_ETHEREUM
};

const multiChainConfig = {
	supported: [CHAIN_NAME, CHAIN_NAME_ETHEREUM],
	active: [CHAIN_NAME, CHAIN_NAME_ETHEREUM]
};

// Setup

const setupMocks = (walletOverrides = {}, chainOverrides = {}) => {
	mockLocalization();
	mockWalletController({ ...symbolWalletConfig, ...walletOverrides });
	mockSupportedChains(chainOverrides);
};

// Default transport URI

const defaultUri = symbolTransferTransactionUri.toTransportString();

describe('screens/transport/TransportRequest', () => {
	beforeEach(() => {
		setupMocks();
	});

	describe('render', () => {
		it('renders share title and description for transfer transaction URI', () => {
			// Arrange:
			const routeProps = createRouteProps(defaultUri);

			// Act:
			const screenTester = new ScreenTester(TransportRequest, routeProps);

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textShareTitle,
				SCREEN_TEXT.textShareDescription
			]);
		});
	});

	describe('request details', () => {
		it('renders recipient address, token name and amount from transfer transaction URI', () => {
			// Arrange:
			const routeProps = createRouteProps(defaultUri);

			// Act:
			const screenTester = new ScreenTester(TransportRequest, routeProps);

			// Assert:
			screenTester.expectText([
				symbolRecipientAccount.address,
				'Symbol \u2022 XYM',
				TRANSFER_AMOUNT
			]);
		});
	});

	describe('alerts', () => {
		const runAlertTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks(config.walletOverrides, config.chainOverrides);
				const routeProps = createRouteProps(config.transportUriString);

				// Act:
				const screenTester = new ScreenTester(TransportRequest, routeProps);

				// Assert:
				screenTester.expectText([expected.alertText]);
				screenTester.notExpectText([
					SCREEN_TEXT.textSuggestedActionsGroup,
					SCREEN_TEXT.textOtherActionsGroup
				]);
			});
		};

		const alertTests = [
			{
				description: 'shows parse error alert for invalid URI',
				config: {
					transportUriString: INVALID_URI
				},
				expected: {
					alertText: SCREEN_TEXT.alertParseError
				}
			},
			{
				description: 'shows unsupported chain alert when URI chain is not in supported list',
				config: {
					transportUriString: ethereumAccountAddressUri.toTransportString()
				},
				expected: {
					alertText: SCREEN_TEXT.alertUnsupportedChain
				}
			},
			{
				description: 'shows inactive chain alert when URI chain is supported but not active',
				config: {
					transportUriString: ethereumAccountAddressUri.toTransportString(),
					chainOverrides: { supported: [CHAIN_NAME, CHAIN_NAME_ETHEREUM], active: [CHAIN_NAME] }
				},
				expected: {
					alertText: SCREEN_TEXT.alertInactiveChain
				}
			},
			{
				description: 'shows network mismatch alert when URI network does not match wallet',
				config: {
					transportUriString: symbolMainnetAccountAddressUri.toTransportString()
				},
				expected: {
					alertText: SCREEN_TEXT.alertNetworkMismatch
				}
			},
			{
				description: 'shows chain ID mismatch alert when URI chain ID differs from wallet',
				config: {
					transportUriString: symbolAccountAddressUriWithChainId.toTransportString()
				},
				expected: {
					alertText: SCREEN_TEXT.alertChainIdMismatch
				}
			}
		];

		alertTests.forEach(test => {
			runAlertTest(test.description, test.config, test.expected);
		});
	});

	describe('actions', () => {
		const runActionsTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks(config.walletOverrides, config.chainOverrides);
				const routerMock = mockRouter({ goToCreateContact: jest.fn(), goToSend: jest.fn() });
				const routeProps = createRouteProps(config.transportUriString);

				// Act:
				const screenTester = new ScreenTester(TransportRequest, routeProps);

				// Assert:
				expected.actions.forEach(({ title, description: actionDescription, navigation }) => {
					screenTester.expectText([title, actionDescription]);
					screenTester.pressButton(title);
					expect(routerMock[navigation.method]).toHaveBeenCalledWith(navigation.params);
				});
			});
		};

		const actionTests = [
			{
				description: 'share account address of main chain - add to address book (suggested) and send transfer (other)',
				config: {
					transportUriString: symbolAccountAddressUri.toTransportString()
				},
				expected: {
					actions: [
						{
							title: SCREEN_TEXT.textAddContactTitle,
							description: SCREEN_TEXT.textAddContactDescription,
							navigation: createNavigation('goToCreateContact', { 
								name: symbolAccount.name, 
								address: symbolAccount.address 
							})
						},
						{
							title: SCREEN_TEXT.textFillTransferFormTitle,
							description: SCREEN_TEXT.textFillTransferFormOnlyAddressDescription,
							navigation: createNavigation('goToSend', {
								chainName: CHAIN_NAME,
								recipientAddress: symbolAccount.address,
								tokenId: undefined,
								amount: undefined
							})
						}
					]
				}
			},
			{
				description: 'share account address of other chain - send transfer only (other)',
				config: {
					transportUriString: symbolAccountAddressUri.toTransportString(),
					walletOverrides: ethereumActiveWalletConfig,
					chainOverrides: multiChainConfig
				},
				expected: {
					actions: [
						{
							title: SCREEN_TEXT.textFillTransferFormTitle,
							description: SCREEN_TEXT.textFillTransferFormOnlyAddressDescription,
							navigation: createNavigation('goToSend', {
								chainName: CHAIN_NAME,
								recipientAddress: symbolAccount.address,
								tokenId: undefined,
								amount: undefined
							})
						}
					]
				}
			},
			{
				description: 'share transfer transaction of main chain - send transfer (suggested) and add to address book (other)',
				config: {
					transportUriString: symbolTransferTransactionUri.toTransportString()
				},
				expected: {
					actions: [
						{
							title: SCREEN_TEXT.textFillTransferFormTitle,
							description: SCREEN_TEXT.textFillTransferFormDescription,
							navigation: createNavigation('goToSend', {
								chainName: CHAIN_NAME,
								recipientAddress: symbolRecipientAccount.address,
								tokenId: xymToken.id,
								amount: xymToken.amount
							})
						},
						{
							title: SCREEN_TEXT.textAddContactTitle,
							description: SCREEN_TEXT.textAddContactDescription,
							navigation: createNavigation('goToCreateContact', { 
								name: undefined, 
								address: symbolRecipientAccount.address 
							})
						}
					]
				}
			},
			{
				description: 'share transfer transaction of other chain - send transfer only (suggested)',
				config: {
					transportUriString: symbolTransferTransactionUri.toTransportString(),
					walletOverrides: ethereumActiveWalletConfig,
					chainOverrides: multiChainConfig
				},
				expected: {
					actions: [
						{
							title: SCREEN_TEXT.textFillTransferFormTitle,
							description: SCREEN_TEXT.textFillTransferFormDescription,
							navigation: createNavigation('goToSend', {
								chainName: CHAIN_NAME,
								recipientAddress: symbolRecipientAccount.address,
								tokenId: xymToken.id,
								amount: xymToken.amount
							})
						}
					]
				}
			}
		];

		actionTests.forEach(test => {
			runActionsTest(test.description, test.config, test.expected);
		});
	});
});
