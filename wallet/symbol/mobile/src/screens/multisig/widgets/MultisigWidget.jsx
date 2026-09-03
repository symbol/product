import { AccountListItem, Spacer, Stack, WidgetContainer } from '@/app/components';
import { useAccountDisplayData, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import React from 'react';

/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * MultisigWidget component. A card widget displaying a scrollable list of multisig accounts
 * with navigation to the full list or individual account details.
 * @param {object} props - Component props.
 * @param {SymbolAccountInfo[]} props.multisigAccountList - List of multisig accounts to display.
 * @param {ChainName} [props.chainName] - The chain the accounts belong to. Defaults to the main chain.
 * @returns {React.ReactNode} MultisigWidget component.
 */
export const MultisigWidget = ({ multisigAccountList, chainName }) => {
	const { ticker } = useWalletController(chainName);
	const accountsDisplayData = useAccountDisplayData(multisigAccountList.map(item => item.address), chainName);

	// Handlers
	const handleHeaderPress = () => Router.goToMultisigAccountList();
	const handleItemPress = item => Router.goToMultisigAccountDetails({
		params: {
			chainName,
			accountAddress: item.address,
			preloadedData: item
		}
	});

	return (
		<WidgetContainer title={$t('s_multisig_widget_name')} onHeaderPress={handleHeaderPress}>
			<Spacer x="s" y="s">
				<Stack gap="s">
					{multisigAccountList.map((item, index) => {
						const accountDisplayData = accountsDisplayData[index];

						return (
							<AccountListItem
								key={item.address}
								address={item.address}
								name={accountDisplayData.name ?? $t('s_multisig_defaultAccountName')}
								amount={item.balance}
								ticker={ticker}
								imageId={accountDisplayData.imageId}
								onPress={() => handleItemPress(item)}
							/>
						);
					})}
				</Stack>
			</Spacer>
		</WidgetContainer>
	);
};
