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
 *
 * @returns {React.ReactNode} Actions screen component
 */
export const Actions = () => {
	const walletController = useWalletController();
	const { currentAccount } = walletController;

	/** @type {ActionItem[]} */
	const actionItems = useMemo(() => [
		{
			title: $t('s_actions_addressBook_title'),
			description: $t('s_actions_addressBook_description'),
			imageSource: require('@/app/assets/images/art/address-book.png'),
			onPress: Router.goToContactList
		},
		{
			title: $t('s_actions_harvesting_title'),
			description: $t('s_actions_harvesting_description'),
			imageSource: require('@/app/assets/images/art/harvesting.png'),
			onPress: Router.goToHarvesting
		},
		{
			title: $t('s_actions_send_title'),
			description: $t('s_actions_send_description'),
			imageSource: require('@/app/assets/images/art/ship.png'),
			onPress: Router.goToSend
		},
		{
			title: $t('s_actions_bridge_title'),
			description: $t('s_actions_bridge_description'),
			imageSource: require('@/app/assets/images/art/bridge.png'),
			onPress: Router.goToBridgeSwap
		},
		{
			title: $t('s_actions_multisig_title'),
			description: $t('s_actions_multisig_description'),
			imageSource: require('@/app/assets/images/art/multisig-chest.png'),
			onPress: Router.goToMultisigAccountList
		}
	], []);

	const renderItem = useCallback(({ item }) => (
		<ActionCard
			title={item.title}
			description={item.description}
			imageSource={item.imageSource}
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
