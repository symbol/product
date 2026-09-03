import { useCreatedMosaicList } from './hooks';
import { ButtonCircle, FilteredListScreenTemplate, Spacer, StyledText, TokenListItem } from '@/app/components';
import { useInit, useRefresh, useTokenDisplayData, useWalletController, useWalletRefreshLifecycle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { createTokenExpiration } from '@/app/utils';
import React, { useCallback } from 'react';

/** @typedef {import('@/app/types/Token').Token} Token */

/**
 * CreatedMosaicListItem component. Resolves a mosaic's display data and renders the token list
 * row with its expiration state.
 * @param {object} props - Component props.
 * @param {Token} props.mosaic - Mosaic to display.
 * @param {object} props.networkProperties - Network properties for the expiration display.
 * @param {function(): void} props.onPress - Press handler.
 * @returns {React.ReactNode} CreatedMosaicListItem component.
 */
const CreatedMosaicListItem = ({ mosaic, networkProperties, onPress }) => {
	const tokenDisplayData = useTokenDisplayData(mosaic);

	return (
		<TokenListItem
			name={tokenDisplayData.name}
			amount={tokenDisplayData.amount}
			ticker={tokenDisplayData.ticker}
			imageId={tokenDisplayData.imageId}
			expiration={createTokenExpiration(mosaic, networkProperties)}
			onPress={onPress}
		/>
	);
};

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
		<CreatedMosaicListItem
			mosaic={item}
			networkProperties={networkProperties}
			onPress={() => openTokenDetails(item)}
		/>
	), [networkProperties, openTokenDetails]);

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
