import { TokenListItem } from './components';
import { useAssetsData } from './hooks';
import { Header } from '@/app/app/components';
import { AccountView, CopyButtonContainer, FilteredListScreenTemplate } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { Router } from '@/app/router/Router';
import React, { useCallback } from 'react';

/**
 * Assets screen component. Displays a filterable list of tokens/mosaics across all connected
 * wallet accounts grouped by chain. Supports filtering by expired and created tokens, and
 * allows navigation to token details screen.
 * @returns {React.ReactNode} Assets component
 */
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
		const handleTokenPress = token => {
			Router.goToTokenDetails({ params: { 
				chainName: section.chainName,
				accountAddress: section.address,
				tokenId: token.id,
				preloadedData: token
			}});
		};

		return (
			<TokenListItem
				token={item}
				chainName={section.chainName}
				networkIdentifier={networkIdentifier}
				chainHeight={networkProperties.chainHeight}
				blockGenerationTargetTime={networkProperties.blockGenerationTargetTime}
				onPress={handleTokenPress}
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
