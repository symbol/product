import { useAssetsData } from './hooks';
import { Header } from '@/app/app/components';
import { AccountRow, CopyButtonContainer, FilteredListScreenTemplate, Spacer, StyledText, TokenListItem } from '@/app/components';
import { useInit, useRefresh, useTokenDisplayData, useWalletController, useWalletRefreshLifecycle } from '@/app/hooks';
import { Router } from '@/app/router/Router';
import { createTokenExpiration } from '@/app/utils';
import React, { useCallback } from 'react';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Token').Token} Token */

/**
 * AssetsTokenListItem component. Resolves a token's display data for its section's chain and
 * renders the token list row with its expiration state.
 * @param {object} props - Component props.
 * @param {Token} props.token - Token to display.
 * @param {ChainName} props.chainName - Chain the token belongs to.
 * @param {object} props.networkProperties - Network properties for the expiration display.
 * @param {function(): void} props.onPress - Press handler.
 * @returns {React.ReactNode} AssetsTokenListItem component.
 */
const AssetsTokenListItem = ({ token, chainName, networkProperties, onPress }) => {
	const tokenDisplayData = useTokenDisplayData(token, chainName);

	return (
		<TokenListItem
			name={tokenDisplayData.name}
			amount={tokenDisplayData.amount}
			ticker={tokenDisplayData.ticker}
			imageId={tokenDisplayData.imageId}
			expiration={createTokenExpiration(token, networkProperties)}
			onPress={onPress}
		/>
	);
};

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
			<AssetsTokenListItem
				token={item}
				chainName={section.chainName}
				networkProperties={networkProperties}
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
