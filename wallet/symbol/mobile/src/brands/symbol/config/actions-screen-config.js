import { SymbolRouter } from '../router/SymbolRouter';

/** @typedef {import('@/app/screens/actions/types/ActionItem').ActionsScreenConfig} ActionsScreenConfig */

/** @type {ActionsScreenConfig} */
export const actionsScreenConfig = {
	cards: [
		{
			id: 'addressBook',
			titleKey: 'screen_actions_item_addressBook_title',
			descriptionKey: 'screen_actions_item_addressBook_description',
			imageSource: require('../assets/images/art/address-book.png'),
			isDisabledForMultisig: false,
			onPress: () => SymbolRouter.goToContactList()
		},
		{
			id: 'harvesting',
			titleKey: 'screen_actions_item_harvesting_title',
			descriptionKey: 'screen_actions_item_harvesting_description',
			imageSource: require('../assets/images/art/harvesting.png'),
			isDisabledForMultisig: true,
			onPress: () => SymbolRouter.goToHarvesting()
		},
		{
			id: 'multisig',
			titleKey: 'screen_actions_item_multisig_title',
			descriptionKey: 'screen_actions_item_multisig_description',
			imageSource: require('../assets/images/art/multisig-chest.png'),
			isDisabledForMultisig: true,
			onPress: () => SymbolRouter.goToMultisigAccountList()
		},
		{
			id: 'bridgeAccounts',
			titleKey: 'screen_actions_item_bridgeAccounts_title',
			descriptionKey: 'screen_actions_item_bridgeAccounts_description',
			imageSource: require('../assets/images/art/external-accounts.png'),
			isDisabledForMultisig: false,
			onPress: () => SymbolRouter.goToBridgeAccountList()
		},
		{
			id: 'send',
			titleKey: 'screen_actions_item_send_title',
			descriptionKey: 'screen_actions_item_send_description',
			imageSource: require('../assets/images/art/ship.png'),
			isDisabledForMultisig: true,
			onPress: () => SymbolRouter.goToSend()
		},
		{
			id: 'createMosaic',
			titleKey: 'screen_actions_item_createMosaic_title',
			descriptionKey: 'screen_actions_item_createMosaic_description',
			imageSource: require('../assets/images/art/mosaic-puzzle.png'),
			isDisabledForMultisig: true,
			onPress: () => SymbolRouter.goToCreatedMosaicList()
		},
		{
			id: 'bridge',
			titleKey: 'screen_actions_item_bridge_title',
			descriptionKey: 'screen_actions_item_bridge_description',
			imageSource: require('../assets/images/art/bridge.png'),
			isDisabledForMultisig: true,
			onPress: () => SymbolRouter.goToBridgeSwap()
		}
	]
};
