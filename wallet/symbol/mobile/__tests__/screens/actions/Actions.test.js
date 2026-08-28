import { Actions } from '@/app/screens/actions/Actions';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';
import { runScreenNavigationTest } from '__tests__/screen-tests';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Screen Text

const SCREEN_TEXT = {
	addressBookTitle: 's_actions_addressBook_title',
	addressBookDescription: 's_actions_addressBook_description',
	harvestingTitle: 's_actions_harvesting_title',
	harvestingDescription: 's_actions_harvesting_description',
	sendTitle: 's_actions_send_title',
	sendDescription: 's_actions_send_description',
	bridgeTitle: 's_actions_bridge_title',
	bridgeDescription: 's_actions_bridge_description',
	multisigTitle: 's_actions_multisig_title',
	multisigDescription: 's_actions_multisig_description',
	bridgeAccountsTitle: 's_actions_bridgeAccounts_title',
	bridgeAccountsDescription: 's_actions_bridgeAccounts_description',
	createMosaicTitle: 's_actions_createMosaic_title',
	createMosaicDescription: 's_actions_createMosaic_description',

	// Icon Labels
	labelLockIcon: 'lock icon'
};

// Card Groups

const TRANSACTION_CARD_TITLES = [
	SCREEN_TEXT.harvestingTitle,
	SCREEN_TEXT.multisigTitle,
	SCREEN_TEXT.sendTitle,
	SCREEN_TEXT.createMosaicTitle,
	SCREEN_TEXT.bridgeTitle
];
const VIEW_ONLY_CARD_TITLES = [
	SCREEN_TEXT.addressBookTitle,
	SCREEN_TEXT.bridgeAccountsTitle
];
const ALL_CARD_TITLES = [...TRANSACTION_CARD_TITLES, ...VIEW_ONLY_CARD_TITLES];

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const regularAccountInfo = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setMultisigStatusByIndexes(false)
	.build();

const multisigAccountInfo = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setMultisigStatusByIndexes(true, [1, 2])
	.build();

// Account Scenarios

const AccountScenario = {
	REGULAR: { currentAccountInfo: regularAccountInfo },
	INFO_NOT_LOADED: { currentAccountInfo: null },
	MULTISIG: { currentAccountInfo: multisigAccountInfo }
};

describe('screens/actions/Actions', () => {
	beforeEach(() => {
		mockLocalization();
		mockWalletController({
			currentAccount
		});
	});

	runRenderTextTest(Actions, {
		textToRender: [
			{ type: 'text', value: currentAccount.name },
			{ type: 'text', value: SCREEN_TEXT.addressBookTitle },
			{ type: 'text', value: SCREEN_TEXT.addressBookDescription },
			{ type: 'text', value: SCREEN_TEXT.harvestingTitle },
			{ type: 'text', value: SCREEN_TEXT.harvestingDescription },
			{ type: 'text', value: SCREEN_TEXT.sendTitle },
			{ type: 'text', value: SCREEN_TEXT.sendDescription },
			{ type: 'text', value: SCREEN_TEXT.bridgeTitle },
			{ type: 'text', value: SCREEN_TEXT.bridgeDescription },
			{ type: 'text', value: SCREEN_TEXT.multisigTitle },
			{ type: 'text', value: SCREEN_TEXT.multisigDescription },
			{ type: 'text', value: SCREEN_TEXT.bridgeAccountsTitle },
			{ type: 'text', value: SCREEN_TEXT.bridgeAccountsDescription },
			{ type: 'text', value: SCREEN_TEXT.createMosaicTitle },
			{ type: 'text', value: SCREEN_TEXT.createMosaicDescription }
		]
	});

	runScreenNavigationTest(Actions, {
		navigationActions: [
			{
				buttonText: SCREEN_TEXT.addressBookTitle,
				actionName: 'goToContactList'
			},
			{
				buttonText: SCREEN_TEXT.harvestingTitle,
				actionName: 'goToHarvesting'
			},
			{
				buttonText: SCREEN_TEXT.sendTitle,
				actionName: 'goToSend'
			},
			{
				buttonText: SCREEN_TEXT.bridgeTitle,
				actionName: 'goToBridgeSwap'
			},
			{
				buttonText: SCREEN_TEXT.multisigTitle,
				actionName: 'goToMultisigAccountList'
			},
			{
				buttonText: SCREEN_TEXT.bridgeAccountsTitle,
				actionName: 'goToBridgeAccountList'
			},
			{
				buttonText: SCREEN_TEXT.createMosaicTitle,
				actionName: 'goToCreatedMosaicList'
			}
		]
	});

	describe('disabled cards', () => {
		const runDisabledCardsTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockWalletController({
					currentAccount,
					currentAccountInfo: config.scenario.currentAccountInfo
				});

				// Act:
				const screenTester = new ScreenTester(Actions);

				// Assert:
				expected.disabledCardTitles.forEach(title => screenTester.expectButtonDisabled(title));
				expected.enabledCardTitles.forEach(title => screenTester.expectButtonEnabled(title));
				screenTester.expectElementCount(SCREEN_TEXT.labelLockIcon, expected.lockIconCount, 'label');
			});
		};

		const disabledCardsTests = [
			{
				description: 'enables all cards for regular account',
				config: { scenario: AccountScenario.REGULAR },
				expected: {
					disabledCardTitles: [],
					enabledCardTitles: ALL_CARD_TITLES,
					lockIconCount: 0
				}
			},
			{
				description: 'enables all cards when account info is not loaded',
				config: { scenario: AccountScenario.INFO_NOT_LOADED },
				expected: {
					disabledCardTitles: [],
					enabledCardTitles: ALL_CARD_TITLES,
					lockIconCount: 0
				}
			},
			{
				description: 'disables transaction cards and shows lock icons for multisig account',
				config: { scenario: AccountScenario.MULTISIG },
				expected: {
					disabledCardTitles: TRANSACTION_CARD_TITLES,
					enabledCardTitles: VIEW_ONLY_CARD_TITLES,
					lockIconCount: TRANSACTION_CARD_TITLES.length
				}
			}
		];

		disabledCardsTests.forEach(test => {
			runDisabledCardsTest(test.description, test.config, test.expected);
		});

		it('does not navigate when disabled card is pressed', () => {
			// Arrange:
			const routerMock = mockRouter({ goToSend: jest.fn() });
			mockWalletController({
				currentAccount,
				currentAccountInfo: AccountScenario.MULTISIG.currentAccountInfo
			});
			const screenTester = new ScreenTester(Actions);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.sendTitle);

			// Assert:
			expect(routerMock.goToSend).not.toHaveBeenCalled();
		});
	});
});
