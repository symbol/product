import { PlaceholderListItem, ReceiptListItem, TransactionListItem } from './components';
import { useHistoryData } from './hooks';
import { SectionType } from './utils';
import { Header } from '@/app/app/components';
import { FilteredListScreenTemplate } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import React, { useCallback } from 'react';

/**
 * History screen component. Displays transaction history with filtering,
 * pagination, and pull-to-refresh functionality.
 */
export const History = () => {
	// Wallet data
	const walletController = useWalletController();
	const {
		accounts,
		networkIdentifier,
		chainName,
		ticker,
		currentAccount
	} = walletController;
	const {addressBook} = walletController.modules;
	const walletAccounts = accounts[networkIdentifier];

	const {
		sections,
		filter,
		setFilter,
		filterConfig,
		isLoading,
		isRefreshing,
		isPageLoading,
		refresh,
		fetchNextPage,
		shouldShowFooter
	} = useHistoryData({ walletController });

	const handleTransactionPress = useCallback(() => {
		// Router.goToTransactionDetails({ transaction }); not implemented
	}, []);

	const renderScreenHeader = useCallback(() => (
		<Header currentAccount={currentAccount} />
	), [currentAccount]);

	const keyExtractor = useCallback((item, index) => {
		return `${index}-${item.hash || item.id || item.height}`;
	}, []);

	const renderItem = useCallback(({ item, section }) => {
		if (section.group === SectionType.RECEIPTS)
			return <ReceiptListItem receipt={item} ticker={ticker} />;

		return (
			<TransactionListItem
				group={section.group}
				transaction={item}
				currentAccount={currentAccount}
				walletAccounts={walletAccounts}
				addressBook={addressBook}
				networkIdentifier={networkIdentifier}
				chainName={chainName}
				ticker={ticker}
				onPress={() => handleTransactionPress(item)}
			/>
		);
	}, [
		currentAccount,
		walletAccounts,
		addressBook,
		networkIdentifier,
		chainName,
		ticker,
		handleTransactionPress
	]);

	const renderPlaceholder = useCallback(() => (
		<>
			<PlaceholderListItem />
			<PlaceholderListItem />
		</>
	), []);

	return (
		<FilteredListScreenTemplate
			listKey={currentAccount.publicKey}
			sections={sections}
			filterConfig={filterConfig}
			filterValue={filter}
			onFilterChange={setFilter}
			isLoading={isLoading}
			isRefreshing={isRefreshing}
			isPageLoading={isPageLoading}
			onRefresh={refresh}
			onEndReached={fetchNextPage}
			keyExtractor={keyExtractor}
			renderScreenHeader={renderScreenHeader}
			renderItem={renderItem}
			renderPlaceholder={renderPlaceholder}
			shouldShowFooter={shouldShowFooter}
		/>
	);
};
