import { TokenListItem } from './components';
import { useAssetsData } from './hooks';
import { Header } from '@/app/app/components';
import { AccountView, CopyButtonContainer, FilteredListScreenTemplate } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { useCallback } from 'react';

export const Assets = () => {
	const walletController = useWalletController();
	const {
		networkIdentifier,
		networkProperties,
		currentAccount
	} = walletController;

	const {
		sections,
		filter,
		setFilter,
		filterConfig,
		isLoading,
		isRefreshing,
		isPageLoading,
		refresh
	} = useAssetsData({ walletController });

	const renderScreenHeader = useCallback(() => (
		<Header currentAccount={currentAccount} />
	), [currentAccount]);

	const keyExtractor = useCallback(item => {
		return `${item.chainName}-${item.id}`;
	}, []);

	const renderSectionHeader = useCallback(({ section }) => (
		<CopyButtonContainer value={section.address} isStretched>
			<AccountView
				address={section.address}
				name={section.chainName}
			/>
		</CopyButtonContainer>
	), []);

	const renderItem = useCallback(({ item, section }) => {
		return (
			<TokenListItem
				token={item}
				chainName={section.chainName}
				networkIdentifier={networkIdentifier}
				chainHeight={networkProperties.chainHeight}
				blockGenerationTargetTime={networkProperties.blockGenerationTargetTime}
			/>
		);
	}, [networkIdentifier, networkProperties.chainHeight, networkProperties.blockGenerationTargetTime]);

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
			keyExtractor={keyExtractor}
			renderScreenHeader={renderScreenHeader}
			renderSectionHeader={renderSectionHeader}
			renderItem={renderItem}
		/>
	);
};
