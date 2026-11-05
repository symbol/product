import { Header } from '@/app/app/components';
import { MultiColumnList, Screen } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { ActionCard } from '@/app/screens/actions/components';
import React, { useCallback, useMemo } from 'react';

/** @typedef {import('@/app/screens/actions/types/ActionItem').ActionItem} ActionItem */

/**
 * Actions screen component. Displays a grid of wallet feature cards providing
 * navigation to various app functionalities like Address Book, Harvesting, Send, and Bridge.
 * @returns {React.ReactNode} Actions screen component.
 */
export const Actions = () => {
	const walletController = useWalletController();
	const { currentAccount, currentAccountInfo } = walletController;

	const isMultisigAccount = currentAccountInfo?.isMultisig ?? false;

	/** @type {ActionItem[]} */
	const actionItems = useMemo(() => [
		{
			title: $t('screen_actions_item_addressBook_title'),
			description: $t('screen_actions_item_addressBook_description'),
			imageSource: require('@/app/assets/images/art/address-book.png'),
			onPress: Router.goToContactList
		},
		{
			title: $t('screen_actions_item_harvesting_title'),
			description: $t('screen_actions_item_harvesting_description'),
			imageSource: require('@/app/assets/images/art/harvesting.png'),
			isDisabled: isMultisigAccount,
			onPress: Router.goToHarvesting
		},
		{
			title: $t('screen_actions_item_multisig_title'),
			description: $t('screen_actions_item_multisig_description'),
			imageSource: require('@/app/assets/images/art/multisig-chest.png'),
			isDisabled: isMultisigAccount,
			onPress: Router.goToMultisigAccountList
		},
		{
			title: $t('screen_actions_item_bridgeAccounts_title'),
			description: $t('screen_actions_item_bridgeAccounts_description'),
			imageSource: require('@/app/assets/images/art/external-accounts.png'),
			onPress: Router.goToBridgeAccountList
		},
		{
			title: $t('screen_actions_item_send_title'),
			description: $t('screen_actions_item_send_description'),
			imageSource: require('@/app/assets/images/art/ship.png'),
			isDisabled: isMultisigAccount,
			onPress: Router.goToSend
		},
		{
			title: $t('screen_actions_item_createMosaic_title'),
			description: $t('screen_actions_item_createMosaic_description'),
			imageSource: require('@/app/assets/images/art/mosaic-puzzle.png'),
			isDisabled: isMultisigAccount,
			onPress: Router.goToCreatedMosaicList
		},
		{
			title: $t('screen_actions_item_bridge_title'),
			description: $t('screen_actions_item_bridge_description'),
			imageSource: require('@/app/assets/images/art/bridge.png'),
			isDisabled: isMultisigAccount,
			onPress: Router.goToBridgeSwap
		}
	], [isMultisigAccount]);

	const renderItem = useCallback(({ item }) => (
		<ActionCard
			title={item.title}
			description={item.description}
			imageSource={item.imageSource}
			isDisabled={item.isDisabled}
			onPress={item.onPress}
		/>
	), []);

	const keyExtractor = useCallback((_, index) => `action-${index}`, []);

	return (
		<Screen isScrollDisabled>
			<Screen.Header>
				<Header currentAccount={currentAccount} />
			</Screen.Header>
			<Screen.Upper>
				<MultiColumnList
					data={actionItems}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					columns={2}
				/>
			</Screen.Upper>
		</Screen>
	);
};
