import { useAssetsData } from './hooks';
import { Header } from '@/app/app/components';
import { AccountRow, CopyButtonContainer, FilteredListScreenTemplate, Spacer, StyledText, TokenListItem } from '@/app/components';
import { useInit, useRefresh, useWalletController, useWalletRefreshLifecycle } from '@/app/hooks';
import { Router } from '@/app/router/Router';
import { createTokenDisplayData, createTokenExpiration } from '@/app/utils';
import React, { useCallback } from 'react';

/**
 * Assets screen component. Displays a filterable list of tokens/mosaics across all connected
 * wallet accounts grouped by chain. Supports filtering by expired and created tokens, and
 * allows navigation to token details screen.
 * @returns {React.ReactNode} Assets component.
 */
export const Assets = () => {
	const walletController = useWalletController();
	const {
		networkProperties,
		currentAccount,
		isWalletReady
	} = walletController;

	// Data fetching
	const {
		sections,
		filter,
		setFilter,
		filterConfig,
		isLoading,
		load,
		reset
	} = useAssetsData();

	// Refresh lifecycle
	useWalletRefreshLifecycle({
		walletController,
		onRefresh: load,
		onClear: reset
	});
	const { refresh, isRefreshing } = useRefresh(load, isLoading);
	useInit(load, isWalletReady);

	const renderScreenHeader = useCallback(() => (
		<Header currentAccount={currentAccount} />
	), [currentAccount]);

	const keyExtractor = useCallback(item => {
		return `${item.chainName}-${item.id}`;
	}, []);

	const renderSectionHeader = useCallback(({ section }) => (
		<>
			{Boolean(section.title) && (
				<Spacer 
					x="none" 
					top={section.hasTopMargin ? 's' : 'none'} 
					bottom="s"
				>
					<StyledText type="title">
						{section.title}
					</StyledText>
				</Spacer>
			)}
			<CopyButtonContainer value={section.address} isStretched>
				<AccountRow
					address={section.address}
					name={section.name}
				/>
			</CopyButtonContainer>
		</>
	), []);

	const renderItem = useCallback(({ item, section }) => {
		const tokenDisplayData = createTokenDisplayData(item, section.chainName, section.networkIdentifier);

		const handleTokenPress = () => {
			Router.goToTokenDetails({
				params: {
					chainName: section.chainName,
					accountAddress: section.address,
					tokenId: item.id,
					preloadedData: item
				}
			});
		};

		return (
			<TokenListItem
				name={tokenDisplayData.nameText}
				amount={tokenDisplayData.amount}
				imageId={tokenDisplayData.imageId}
				expiration={createTokenExpiration(item, networkProperties)}
				onPress={handleTokenPress}
			/>
		);
	}, [networkProperties]);

	return (
		<FilteredListScreenTemplate
			listKey={currentAccount.publicKey}
			sections={sections}
			filterConfig={filterConfig}
			filterValue={filter}
			onFilterChange={setFilter}
			isLoading={isLoading}
			isRefreshing={isRefreshing}
			onRefresh={refresh}
			keyExtractor={keyExtractor}
			renderScreenHeader={renderScreenHeader}
			renderSectionHeader={renderSectionHeader}
			renderItem={renderItem}
		/>
	);
};
