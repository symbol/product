import { Header } from '@/app/app/components';
import { MultiColumnList, Screen } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { ActionCard } from '@/app/screens/actions/components';
import { actionsScreenConfig } from '@/brand/config/actions-screen-config';
import React, { useCallback } from 'react';

/**
 * Actions screen component. Displays a grid of wallet feature cards providing
 * navigation to various app functionalities like Address Book, Harvesting, Send, and Bridge.
 * @returns {React.ReactNode} Actions screen component.
 */
export const Actions = () => {
	const walletController = useWalletController();
	const { currentAccount, currentAccountInfo } = walletController;

	const isMultisigAccount = currentAccountInfo?.isMultisig ?? false;

	const renderItem = useCallback(({ item }) => (
		<ActionCard
			title={$t(item.titleKey)}
			description={$t(item.descriptionKey)}
			imageSource={item.imageSource}
			isDisabled={item.isDisabledForMultisig && isMultisigAccount}
			onPress={item.onPress}
		/>
	), [isMultisigAccount]);

	const keyExtractor = useCallback(item => item.id, []);

	return (
		<Screen isScrollDisabled>
			<Screen.Header>
				<Header currentAccount={currentAccount} />
			</Screen.Header>
			<Screen.Upper>
				<MultiColumnList
					data={actionsScreenConfig.cards}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					columns={2}
				/>
			</Screen.Upper>
		</Screen>
	);
};
