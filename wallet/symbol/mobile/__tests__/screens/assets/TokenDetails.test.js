import { TokenDetails } from '@/app/screens/assets/TokenDetails';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const CHAIN_HEIGHT_ACTIVE = 150_000;
const CHAIN_HEIGHT_EXPIRED = 200_000;
const BLOCK_GENERATION_TARGET_TIME = 30;

const TOKEN_ID = 'E74B99BA41F4AFB4';
const TOKEN_NAME = 'Test Token';
const TOKEN_TICKER = 'XYM';
const TOKEN_DISPLAY_NAME = `${TOKEN_NAME} • ${TOKEN_TICKER}`;
const TOKEN_AMOUNT = '1000';
const TOKEN_AMOUNT_REFRESHED = '750';
const TOKEN_AMOUNT_ZERO = '0';
const TOKEN_SUPPLY = '10000000';
const TOKEN_DIVISIBILITY = 6;
const TOKEN_START_HEIGHT = 100_000;
const TOKEN_END_HEIGHT = 180_000;

// Mocks

jest.mock('@/app/utils', () => ({
	...jest.requireActual('@/app/utils'),
	getTokenKnownInfo: () => ({
		name: TOKEN_NAME,
		ticker: TOKEN_TICKER,
		imageId: 'image'
	})
}));

// Screen Text

const SCREEN_TEXT = {
	// Field titles
	textFieldTitleBalance: 'fieldTitle_balance',
	textFieldTitleId: 'fieldTitle_id',
	textFieldTitleChainName: 'fieldTitle_chainName',
	textFieldTitleCreator: 'fieldTitle_creator',
	textFieldTitleSupply: 'fieldTitle_supply',
	textFieldTitleDivisibility: 'fieldTitle_divisibility',
	textFieldTitleRegistrationHeight: 'fieldTitle_registrationHeight',
	textFieldTitleCurrentChainHeight: 'fieldTitle_currentChainHeight',
	textFieldTitleExpirationHeight: 'fieldTitle_expirationHeight',

	// Alert texts
	textAlertExpired: 's_assetDetails_alert_expired_description',
	textAlertExpirable: 's_assetDetails_alert_expirable_description',

	// Expiration progress texts
	textExpired: 's_assets_item_expired',
	textExpireIn: 's_assets_item_expireIn',

	// Buttons
	buttonSend: 'button_send',
	buttonRevoke: 'button_revoke',
	buttonModify: 'button_modifyMosaic',

	// Errors
	textNotFound: 'message_emptyList'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const externalAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

// Network Properties Fixtures

const networkPropertiesActive = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setChainHeight(CHAIN_HEIGHT_ACTIVE)
	.override({ blockGenerationTargetTime: BLOCK_GENERATION_TARGET_TIME })
	.build();

const networkPropertiesExpired = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setChainHeight(CHAIN_HEIGHT_EXPIRED)
	.override({ blockGenerationTargetTime: BLOCK_GENERATION_TARGET_TIME })
	.build();

// Token Fixtures

const tokenBase = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setId(TOKEN_ID)
	.setAmount(TOKEN_AMOUNT)
	.setDivisibility(TOKEN_DIVISIBILITY);

const tokenOwnedByCurrentAccount = tokenBase
	.setCreator(currentAccount.address)
	.override({ supply: TOKEN_SUPPLY })
	.build();

const tokenOwnedByExternalAccount = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setId(TOKEN_ID)
	.setAmount(TOKEN_AMOUNT)
	.setDivisibility(TOKEN_DIVISIBILITY)
	.setCreator(externalAccount.address)
	.override({ supply: TOKEN_SUPPLY })
	.build();

// Tokens the creator is allowed to revoke and to change the supply of
const createManageableToken = creator => TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setId(TOKEN_ID)
	.setAmount(TOKEN_AMOUNT)
	.setDivisibility(TOKEN_DIVISIBILITY)
	.setCreator(creator)
	.setIsUnlimitedDuration(true)
	.override({
		supply: TOKEN_SUPPLY,
		isRevokable: true,
		isSupplyMutable: true
	})
	.build();

const manageableTokenOwnedByCurrentAccount = createManageableToken(currentAccount.address);
const manageableTokenOwnedByExternalAccount = createManageableToken(externalAccount.address);

const tokenWithoutCreator = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setId(TOKEN_ID)
	.setAmount(TOKEN_AMOUNT)
	.setDivisibility(TOKEN_DIVISIBILITY)
	.build();

const tokenNonExpirable = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setId(TOKEN_ID)
	.setAmount(TOKEN_AMOUNT)
	.setCreator(currentAccount.address)
	.setIsUnlimitedDuration(true)
	.build();

const tokenExpirable = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setId(TOKEN_ID)
	.setAmount(TOKEN_AMOUNT)
	.setCreator(currentAccount.address)
	.setStartHeight(TOKEN_START_HEIGHT)
	.setEndHeight(TOKEN_END_HEIGHT)
	.setIsUnlimitedDuration(false)
	.build();

const tokenHeldAfterRefresh = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setId(TOKEN_ID)
	.setAmount(TOKEN_AMOUNT_REFRESHED)
	.setDivisibility(TOKEN_DIVISIBILITY)
	.build();

const fetchedTokenInfo = {
	id: TOKEN_ID,
	names: [TOKEN_NAME],
	divisibility: TOKEN_DIVISIBILITY,
	supply: TOKEN_SUPPLY,
	creator: currentAccount.address,
	isUnlimitedDuration: true
};

// Account Info Fixtures

const createAccountInfoWithToken = token => AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setMosaics([token])
	.build();

const accountInfoWithoutToken = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setMosaics([])
	.build();

// Route Props Factory

const createRouteProps = (tokenId, preloadedData, accountAddress = currentAccount.address) => ({
	route: {
		params: {
			chainName: CHAIN_NAME,
			tokenId,
			accountAddress,
			preloadedData
		}
	}
});

// Wallet Controller Configuration

const createWalletControllerConfig = (accountInfo, networkProperties, networkApi = {}) => ({
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	currentAccount,
	currentAccountInfo: accountInfo,
	networkProperties,
	networkApi,
	modules: {
		addressBook: {
			whiteList: [],
			blackList: [],
			contacts: [],
			getContactByAddress: jest.fn().mockReturnValue(null)
		}
	}
});

// Tests

describe('screens/assets/TokenDetails', () => {
	beforeEach(() => {
		mockLocalization();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders token main info', async () => {
			// Arrange:
			const accountInfo = createAccountInfoWithToken(tokenOwnedByCurrentAccount);
			mockWalletController(createWalletControllerConfig(accountInfo, networkPropertiesActive));
			const expectedTexts = [
				SCREEN_TEXT.textFieldTitleBalance,
				SCREEN_TEXT.textFieldTitleId,
				SCREEN_TEXT.textFieldTitleChainName,
				SCREEN_TEXT.textFieldTitleCreator,
				SCREEN_TEXT.buttonSend,
				TOKEN_DISPLAY_NAME,
				TOKEN_AMOUNT,
				TOKEN_ID,
				CHAIN_NAME,
				currentAccount.address
			];

			// Act:
			const screenTester = new ScreenTester(TokenDetails, createRouteProps(TOKEN_ID, tokenOwnedByCurrentAccount));
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('refresh', () => {
		const runRefreshTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const accountInfo = config.heldToken
					? createAccountInfoWithToken(config.heldToken)
					: accountInfoWithoutToken;
				const networkApi = {
					account: { fetchAccountInfo: jest.fn().mockResolvedValue(accountInfo) },
					mosaic: { fetchMosaicInfo: jest.fn().mockResolvedValue(config.fetchedTokenInfo) }
				};
				mockWalletController(createWalletControllerConfig(accountInfo, networkPropertiesActive, networkApi));

				// Act:
				const screenTester = new ScreenTester(TokenDetails, createRouteProps(TOKEN_ID, tokenOwnedByCurrentAccount));
				screenTester.pullToRefresh();
				await screenTester.waitForTimer();

				// Assert:
				expect(networkApi.account.fetchAccountInfo).toHaveBeenCalledWith(networkPropertiesActive, currentAccount.address);

				if (expected.isTokenInfoFetched)
					expect(networkApi.mosaic.fetchMosaicInfo).toHaveBeenCalledWith(networkPropertiesActive, TOKEN_ID);
				else
					expect(networkApi.mosaic.fetchMosaicInfo).not.toHaveBeenCalled();

				if (expected.textsRendered?.length)
					screenTester.expectText(expected.textsRendered);

				if (expected.textsNotRendered?.length)
					screenTester.notExpectText(expected.textsNotRendered);
			});
		};

		const refreshTests = [
			{
				description: 'renders the refreshed balance when the account still holds the token',
				config: {
					heldToken: tokenHeldAfterRefresh
				},
				expected: {
					isTokenInfoFetched: false,
					textsRendered: [
						TOKEN_DISPLAY_NAME,
						TOKEN_AMOUNT_REFRESHED
					]
				}
			},
			{
				description: 'renders zero balance with the fetched token info when the account no longer holds the token',
				config: {
					fetchedTokenInfo
				},
				expected: {
					isTokenInfoFetched: true,
					textsRendered: [
						TOKEN_DISPLAY_NAME,
						TOKEN_AMOUNT_ZERO,
						TOKEN_SUPPLY,
						SCREEN_TEXT.buttonSend
					],
					textsNotRendered: [
						SCREEN_TEXT.textNotFound
					]
				}
			},
			{
				description: 'renders the not found message when the token info is unavailable',
				config: {
					fetchedTokenInfo: undefined
				},
				expected: {
					isTokenInfoFetched: true,
					textsRendered: [
						SCREEN_TEXT.textNotFound
					],
					textsNotRendered: [
						TOKEN_DISPLAY_NAME,
						SCREEN_TEXT.buttonSend
					]
				}
			}
		];

		refreshTests.forEach(test => {
			runRefreshTest(test.description, test.config, test.expected);
		});
	});

	describe('additional token info', () => {
		const runAdditionalInfoTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const accountInfo = createAccountInfoWithToken(config.token);
				mockWalletController(createWalletControllerConfig(accountInfo, networkPropertiesActive));

				// Act:
				const screenTester = new ScreenTester(TokenDetails, createRouteProps(TOKEN_ID, config.token));

				// Assert:
				if (expected.textsRendered?.length)
					screenTester.expectText(expected.textsRendered);
				
				if (expected.textsNotRendered?.length)
					screenTester.notExpectText(expected.textsNotRendered);
			});
		};

		const additionalInfoTests = [
			{
				description: 'renders supply and divisibility when token creator is current account',
				config: {
					token: tokenOwnedByCurrentAccount
				},
				expected: {
					textsRendered: [
						SCREEN_TEXT.textFieldTitleSupply,
						SCREEN_TEXT.textFieldTitleDivisibility,
						TOKEN_SUPPLY,
						String(TOKEN_DIVISIBILITY)
					]
				}
			},
			{
				description: 'does not render supply and divisibility when token creator is not current account',
				config: {
					token: tokenOwnedByExternalAccount
				},
				expected: {
					textsNotRendered: [
						SCREEN_TEXT.textFieldTitleSupply,
						SCREEN_TEXT.textFieldTitleDivisibility,
						TOKEN_SUPPLY
					]
				}
			},
			{
				description: 'does not render creator title and value if value is not in the token object',
				config: {
					token: tokenWithoutCreator
				},
				expected: {
					textsNotRendered: [
						SCREEN_TEXT.textFieldTitleCreator
					]
				}
			}
		];

		additionalInfoTests.forEach(test => {
			runAdditionalInfoTest(test.description, test.config, test.expected);
		});
	});

	describe('expiration section', () => {
		const runExpirationTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const accountInfo = createAccountInfoWithToken(config.token);
				mockWalletController(createWalletControllerConfig(accountInfo, config.networkProperties));

				// Act:
				const screenTester = new ScreenTester(TokenDetails, createRouteProps(TOKEN_ID, config.token));

				// Assert:
				if (expected.textsRendered?.length)
					screenTester.expectText(expected.textsRendered);
				
				if (expected.textsNotRendered?.length)
					screenTester.notExpectText(expected.textsNotRendered);
			});
		};

		const expirationTests = [
			{
				description: 'does not render expiration section when token has no end height',
				config: {
					token: tokenNonExpirable,
					networkProperties: networkPropertiesActive
				},
				expected: {
					textsNotRendered: [
						SCREEN_TEXT.textFieldTitleRegistrationHeight,
						SCREEN_TEXT.textFieldTitleCurrentChainHeight,
						SCREEN_TEXT.textFieldTitleExpirationHeight
					]
				}
			},
			{
				description: 'renders expiration section with warning when token is expirable but not expired',
				config: {
					token: tokenExpirable,
					networkProperties: networkPropertiesActive
				},
				expected: {
					textsRendered: [
						SCREEN_TEXT.textFieldTitleRegistrationHeight,
						SCREEN_TEXT.textFieldTitleCurrentChainHeight,
						SCREEN_TEXT.textFieldTitleExpirationHeight,
						String(TOKEN_START_HEIGHT),
						String(CHAIN_HEIGHT_ACTIVE),
						String(TOKEN_END_HEIGHT),
						SCREEN_TEXT.textAlertExpirable,
						SCREEN_TEXT.textExpireIn
					],
					textsNotRendered: [
						SCREEN_TEXT.textAlertExpired,
						SCREEN_TEXT.textExpired
					]
				}
			},
			{
				description: 'renders expiration section with danger when token is expired',
				config: {
					token: tokenExpirable,
					networkProperties: networkPropertiesExpired
				},
				expected: {
					textsRendered: [
						SCREEN_TEXT.textFieldTitleRegistrationHeight,
						SCREEN_TEXT.textFieldTitleCurrentChainHeight,
						SCREEN_TEXT.textFieldTitleExpirationHeight,
						String(TOKEN_START_HEIGHT),
						String(CHAIN_HEIGHT_EXPIRED),
						String(TOKEN_END_HEIGHT),
						SCREEN_TEXT.textAlertExpired,
						SCREEN_TEXT.textExpired
					],
					textsNotRendered: [
						SCREEN_TEXT.textAlertExpirable,
						SCREEN_TEXT.textExpireIn
					]
				}
			}
		];

		expirationTests.forEach(test => {
			runExpirationTest(test.description, test.config, test.expected);
		});
	});

	describe('send button', () => {
		const runSendButtonTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const accountInfo = createAccountInfoWithToken(config.token);
				mockWalletController(createWalletControllerConfig(accountInfo, config.networkProperties));
				const routerMock = mockRouter({ goToSend: jest.fn() });
				const navigationParams = { chainName: CHAIN_NAME, tokenId: TOKEN_ID, senderAddress: currentAccount.address };

				// Act:
				const screenTester = new ScreenTester(TokenDetails, createRouteProps(TOKEN_ID, config.token));
				screenTester.pressButton(SCREEN_TEXT.buttonSend);

				// Assert:
				if (expected.shouldCallRouter)
					expect(routerMock.goToSend).toHaveBeenCalledWith({ params: navigationParams });
				else
					expect(routerMock.goToSend).not.toHaveBeenCalled();

				if (expected.isDisabled)
					screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
				else
					screenTester.expectButtonEnabled(SCREEN_TEXT.buttonSend);
			});
		};

		const sendButtonTests = [
			{
				description: 'send button is enabled when token is not expirable',
				config: {
					token: tokenNonExpirable,
					networkProperties: networkPropertiesActive
				},
				expected: {
					isDisabled: false,
					shouldCallRouter: true
				}
			},
			{
				description: 'send button is enabled when token is not yet expired',
				config: {
					token: tokenExpirable,
					networkProperties: networkPropertiesActive
				},
				expected: {
					isDisabled: false,
					shouldCallRouter: true
				}
			},
			{
				description: 'send button is disabled when token is expired',
				config: {
					token: tokenExpirable,
					networkProperties: networkPropertiesExpired
				},
				expected: {
					isDisabled: true,
					shouldCallRouter: false
				}
			}
		];

		sendButtonTests.forEach(test => {
			runSendButtonTest(test.description, test.config, test.expected);
		});
	});

	describe('creator actions', () => {
		const runCreatorActionsTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const accountInfo = createAccountInfoWithToken(config.token);
				mockWalletController(createWalletControllerConfig(accountInfo, networkPropertiesActive));

				// Act:
				const screenTester = new ScreenTester(
					TokenDetails,
					createRouteProps(TOKEN_ID, config.token, config.accountAddress)
				);

				// Assert:
				if (expected.areActionsRendered)
					screenTester.expectText([SCREEN_TEXT.buttonRevoke, SCREEN_TEXT.buttonModify]);
				else
					screenTester.notExpectText([SCREEN_TEXT.buttonRevoke, SCREEN_TEXT.buttonModify]);
			});
		};

		const creatorActionsTests = [
			{
				description: 'renders the revoke and modify actions for a token created by the current account',
				config: {
					token: manageableTokenOwnedByCurrentAccount,
					accountAddress: currentAccount.address
				},
				expected: { areActionsRendered: true }
			},
			{
				// Only the current account can sign the mosaic management transactions
				description: 'hides the revoke and modify actions when the token is viewed on behalf of another account',
				config: {
					token: manageableTokenOwnedByExternalAccount,
					accountAddress: externalAccount.address
				},
				expected: { areActionsRendered: false }
			},
			{
				description: 'hides the revoke and modify actions for a token created by another account',
				config: {
					token: manageableTokenOwnedByExternalAccount,
					accountAddress: currentAccount.address
				},
				expected: { areActionsRendered: false }
			}
		];

		creatorActionsTests.forEach(test => {
			runCreatorActionsTest(test.description, test.config, test.expected);
		});
	});

	describe('creator action navigation', () => {
		const runNavigationTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const accountInfo = createAccountInfoWithToken(manageableTokenOwnedByCurrentAccount);
				mockWalletController(createWalletControllerConfig(accountInfo, networkPropertiesActive));
				const routerMock = mockRouter({ goToRevokeMosaic: jest.fn(), goToModifyMosaic: jest.fn() });

				// Act:
				const screenTester = new ScreenTester(
					TokenDetails,
					createRouteProps(TOKEN_ID, manageableTokenOwnedByCurrentAccount)
				);
				screenTester.pressButton(config.button);

				// Assert:
				expect(routerMock[expected.routerMethod]).toHaveBeenCalledWith({
					params: { chainName: CHAIN_NAME, mosaicId: TOKEN_ID }
				});
			});
		};

		const navigationTests = [
			{
				description: 'opens the revoke screen for the token without a pre-selected creator',
				config: { button: SCREEN_TEXT.buttonRevoke },
				expected: { routerMethod: 'goToRevokeMosaic' }
			},
			{
				description: 'opens the modify screen for the token without a pre-selected creator',
				config: { button: SCREEN_TEXT.buttonModify },
				expected: { routerMethod: 'goToModifyMosaic' }
			}
		];

		navigationTests.forEach(test => {
			runNavigationTest(test.description, test.config, test.expected);
		});
	});
});
