import { Spacer, Stack, WidgetContainer } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { MultisigAccountListItem } from '@/app/screens/multisig/components';
import React from 'react';

/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * MultisigWidget component. A card widget displaying a scrollable list of multisig accounts
 * with navigation to the full list or individual account details.
 * @param {object} props - Component props.
 * @param {SymbolAccountInfo[]} props.multisigAccountList - List of multisig accounts to display.
 * @param {ChainName} props.chainName - The blockchain name.
 * @param {NetworkIdentifier} props.networkIdentifier - The network identifier.
 * @param {string} props.ticker - The native currency ticker symbol.
 * @param {WalletAccount[]} [props.walletAccounts] - Wallet accounts for resolving account names.
 * @param {object} [props.addressBook] - Address book for resolving account names.
 * @returns {React.ReactNode} MultisigWidget component.
 */
export const MultisigWidget = ({
	multisigAccountList,
	chainName,
	networkIdentifier,
	ticker,
	walletAccounts,
	addressBook
}) => {
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
					{multisigAccountList.map(item => (
						<MultisigAccountListItem
							key={item.address}
							address={item.address}
							balance={item.balance}
							ticker={ticker}
							walletAccounts={walletAccounts}
							addressBook={addressBook}
							chainName={chainName}
							networkIdentifier={networkIdentifier}
							onPress={() => handleItemPress(item)}
						/>
					))}
				</Stack>
			</Spacer>
		</WidgetContainer>
	);
};
