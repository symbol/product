import { useCreatedTokenList } from './hooks';
import { ButtonCircle, FilteredListScreenTemplate, Spacer, StyledText, TokenListItem } from '@/app/components';
import { useInit, useRefresh, useWalletController, useWalletRefreshLifecycle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import React, { useCallback } from 'react';

/**
 * CreatedTokenList screen component. Displays the paginated list of tokens created by the
 * current account, including zero-balance and expired ones. Supports filtering by token flags,
 * and allows navigation to token details or creating a new token.
 * @returns {React.ReactNode} CreatedTokenList component.
 */
export const CreatedTokenList = () => {
	const walletController = useWalletController();
	const {
		chainName,
		networkIdentifier,
		networkProperties,
		currentAccount,
		isWalletReady
	} = walletController;

	// Data fetching
	const {
		sections,
		filterConfig,
		filter,
		setFilter,
		load,
		reset,
		fetchNextPage,
		isLoading,
		isPageLoading,
		isLastPage
	} = useCreatedTokenList(walletController);

	// Refresh lifecycle
	useWalletRefreshLifecycle({
		walletController,
		onRefresh: load,
		onClear: reset
	});
	const { refresh, isRefreshing } = useRefresh(load, isLoading);
	useInit(load, isWalletReady);

	// Navigation handlers
	const openTokenDetails = useCallback(token => {
		Router.goToTokenDetails({
			params: {
				chainName,
				accountAddress: currentAccount.address,
				tokenId: token.id,
				preloadedData: token
			}
		});
	}, [chainName, currentAccount.address]);

	const openCreateMosaic = useCallback(() => {
		Router.goToCreateMosaic();
	}, []);

	// Render helpers
	const keyExtractor = useCallback(token => token.id, []);

	const renderListHeader = useCallback(() => (
		<Spacer>
			<StyledText type="title">
				{$t('s_createdTokenList_title')}
			</StyledText>
			<StyledText type="body">
				{$t('s_createdTokenList_description')}
			</StyledText>
		</Spacer>
	), []);

	const renderItem = useCallback(({ item }) => (
		<TokenListItem
			token={item}
			chainName={chainName}
			networkIdentifier={networkIdentifier}
			chainHeight={networkProperties.chainHeight}
			blockGenerationTargetTime={networkProperties.blockGenerationTargetTime}
			onPress={openTokenDetails}
		/>
	), [chainName, networkIdentifier, networkProperties.chainHeight, networkProperties.blockGenerationTargetTime, openTokenDetails]);

	const renderSectionHeader = useCallback(() => null, []);

	const renderScreenBottom = useCallback(() => (
		<ButtonCircle
			icon="plus"
			isFloating
			onPress={openCreateMosaic}
		/>
	), [openCreateMosaic]);

	const shouldShowFooter = useCallback(() => !isLastPage, [isLastPage]);

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
			renderItem={renderItem}
			renderListHeader={renderListHeader}
			renderSectionHeader={renderSectionHeader}
			renderScreenBottom={renderScreenBottom}
			shouldShowFooter={shouldShowFooter}
		/>
	);
};
