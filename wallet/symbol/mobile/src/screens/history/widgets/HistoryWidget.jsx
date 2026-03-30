import { TransactionListItem } from '../components/TransactionListItem';
import { Spacer, Stack, WidgetContainer } from '@/app/components';
import { TransactionGroup } from '@/app/constants';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import React, { useMemo } from 'react';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/**
 * HistoryWidget component. Displays pending (partial and unconfirmed) transactions
 * in a card widget on the home screen.
 *
 * @param {Object} props - Component props.
 * @param {Transaction[]} props.partial - Partial (pending multisig) transactions.
 * @param {Transaction[]} props.unconfirmed - Unconfirmed transactions.
 * @param {WalletAccount} props.currentAccount - Current user account.
 * @param {WalletAccount[]} props.walletAccounts - Wallet accounts for the network.
 * @param {Object} props.addressBook - Address book instance.
 * @param {NetworkIdentifier} props.networkIdentifier - Network identifier (e.g., 'mainnet').
 * @param {string} props.chainName - Chain name (e.g., 'symbol').
 * @param {string} props.ticker - Ticker symbol for the network currency.
 * @returns {React.ReactNode} HistoryWidget component.
 */
export const HistoryWidget = ({
	partial,
	unconfirmed,
	currentAccount,
	walletAccounts,
	addressBook,
	networkIdentifier,
	chainName,
	ticker
}) => {
	// Combine and tag transactions with their group
	const transactions = useMemo(() => [
		...partial.map(tx => ({ ...tx, group: TransactionGroup.PARTIAL })),
		...unconfirmed.map(tx => ({ ...tx, group: TransactionGroup.UNCONFIRMED }))
	], [partial, unconfirmed]);

	// Handlers
	const handleHeaderPress = () => Router.goToHistory();
	const handleTransactionPress = (transaction, group) => Router.goToTransactionDetails({
		params: {
			chainName,
			transaction,
			group
		}
	});

	return (
		<WidgetContainer title={$t('s_history_widget_name')} onHeaderPress={handleHeaderPress}>
			<Spacer>
				<Stack>
					{transactions.map(item => (
						<TransactionListItem
							key={`tx-${item.hash || item.id}`}
							group={item.group}
							transaction={item}
							currentAccount={currentAccount}
							walletAccounts={walletAccounts}
							addressBook={addressBook}
							networkIdentifier={networkIdentifier}
							chainName={chainName}
							ticker={ticker}
							onPress={() => handleTransactionPress(item, item.group)}
						/>
					))}
				</Stack>
			</Spacer>
		</WidgetContainer>
	);
};
