import { useCreatedMosaicList } from './hooks';
import { ButtonCircle, FilteredListScreenTemplate, Spacer, StyledText, TokenListItem } from '@/app/components';
import { useInit, useRefresh, useWalletController, useWalletRefreshLifecycle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import React, { useCallback } from 'react';

/**
 * CreatedMosaicList screen component. Displays the paginated list of mosaics created by the
 * current account, including zero-balance and expired ones. Supports filtering by mosaic flags,
 * and allows opening a mosaic's details or creating a new one.
 * @returns {React.ReactNode} CreatedMosaicList component.
 */
export const CreatedMosaicList = () => {
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
	} = useCreatedMosaicList(walletController);

	// Refresh lifecycle
	useWalletRefreshLifecycle({
		walletController,
		onRefresh: load,
		onClear: reset
	});
	const { refresh, isRefreshing } = useRefresh(load, isLoading);
	useInit(load, isWalletReady);

	// Navigation handlers
	const openTokenDetails = useCallback(mosaic => {
		Router.goToTokenDetails({
			params: {
				chainName,
				accountAddress: currentAccount.address,
				tokenId: mosaic.id,
				preloadedData: mosaic
			}
		});
	}, [chainName, currentAccount.address]);

	const openCreateMosaic = useCallback(() => {
		Router.goToCreateMosaic();
	}, []);

	// Render helpers
	const keyExtractor = useCallback(mosaic => mosaic.id, []);

	const renderListHeader = useCallback(() => (
		<Spacer>
			<StyledText type="title">
				{$t('s_createdMosaicList_title')}
			</StyledText>
			<StyledText type="body">
				{$t('s_createdMosaicList_description')}
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
