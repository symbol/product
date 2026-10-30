import { NemRouter } from '../router/NemRouter';

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
			onPress: () => NemRouter.goToContactList()
		},
		{
			id: 'send',
			titleKey: 'screen_actions_item_send_title',
			descriptionKey: 'screen_actions_item_send_description',
			imageSource: require('../assets/images/art/ship.png'),
			isDisabledForMultisig: true,
			onPress: () => NemRouter.goToSend()
		}
	]
};
