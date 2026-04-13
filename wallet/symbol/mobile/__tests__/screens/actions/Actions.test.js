import { Actions } from '@/app/screens/actions/Actions';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization, mockWalletController } from '__tests__/mock-helpers';
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
	multisigDescription: 's_actions_multisig_description'
};

// Account Fixture

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

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
			{ type: 'text', value: SCREEN_TEXT.multisigDescription }
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
			}
		]
	});
});
