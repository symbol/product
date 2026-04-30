import { AnimatedListItem, Filter, LoadingIndicator, Screen, StyledText } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Colors, Sizes } from '@/app/styles';
import React, { useCallback } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

const LIST_PADDING = Sizes.Semantic.layoutPadding.m;
const LIST_GAP = Sizes.Semantic.layoutSpacing.s;
const NEXT_PAGE_TRIGGER_THRESHOLD = 0.75;

/**
 * Empty list placeholder component.
 * @returns {React.ReactNode}
 */
const EmptyListPlaceholder = () => (
	<View style={styles.emptyList}>
		<StyledText type="label" style={styles.emptyListText}>
			{$t('message_emptyList')}
		</StyledText>
	</View>
);

/**
 * Section header component.
 * @param {object} props - Component props.
 * @param {string} props.title - Section title text.
 * @param {object} [props.titleStyle] - Custom title styles.
 * @returns {React.ReactNode}
 */
const SectionHeader = ({ title, titleStyle }) => (
	<StyledText type="label" style={titleStyle}>
		{title}
	</StyledText>
);

/**
 * Loading footer component for pagination.
 * @param {object} props - Component props.
 * @param {boolean} props.isLoading - Whether loading indicator should be shown.
 * @param {function(object): React.ReactNode} props.renderPlaceholder - Function to render placeholder items.
 * @returns {React.ReactNode}
 */
const LoadingFooter = ({ isLoading, renderPlaceholder }) => (
	<View style={styles.sectionFooter}>
		{renderPlaceholder?.()}
		{isLoading && (
			<LoadingIndicator style={styles.loadingIndicator} size="sm" />
		)}
	</View>
);

/**
 * Section configuration for the filtered list, including title, group, and data items.
 * @typedef {object} Section
 * @property {string} title - Section title.
 * @property {string} group - Section group identifier.
 * @property {Array} data - Section data items.
 * @property {object} [titleStyle] - Custom title style.
 */

/**
 * Configuration for a single filter field displayed in the list header.
 * @typedef {object} FilterConfig
 * @property {string} name - Filter field name.
 * @property {string} title - Filter display title.
 * @property {string} type - Filter type ('select', 'boolean', 'address').
 * @property {Array} [options] - Options for select type filters.
 */

/**
 * FilteredListScreenTemplate component. A reusable template for screens with a filter
 * header and a sectioned list. Provides consistent styling and behavior for list screens.
 * @param {object} props - Component props.
 * @param {string} props.listKey - Unique key for the SectionList (forces re-render when changed).
 * @param {Section[]} props.sections - Array of section configurations.
 * @param {FilterConfig[]} props.filterConfig - Filter configuration array.
 * @param {object} props.filterValue - Current filter values.
 * @param {function(object): void} props.onFilterChange - Callback when filter values change.
 * @param {boolean} props.isLoading - Whether initial loading is in progress.
 * @param {boolean} props.isRefreshing - Whether refresh is in progress.
 * @param {boolean} props.isPageLoading - Whether next page is loading.
 * @param {boolean} props.isFilterDisabled - Whether filter should be disabled.
 * @param {function(): void} props.onRefresh - Callback for pull-to-refresh.
 * @param {function(): void} props.onEndReached - Callback when list end is reached.
 * @param {function(object): string} props.keyExtractor - Function to extract unique keys from items.
 * @param {function(object): React.ReactNode} props.renderItem - Function to render list items.
 * @param {function(): React.ReactNode} [props.renderScreenHeader] - Function to render custom screen header.
 * @param {function(object): React.ReactNode} [props.renderSectionHeader] - Function to render custom section headers.
 * @param {function(object): React.ReactNode} [props.renderPlaceholder] - Function to render placeholder items during loading.
 * @param {function(object): boolean} [props.shouldShowFooter] - Function to determine if footer should be shown for a section.
 * @returns {React.ReactNode} FilteredListScreenTemplate component.
 */
export const FilteredListScreenTemplate = ({
	listKey,
	sections,
	filterConfig,
	filterValue,
	onFilterChange,
	isLoading,
	isRefreshing,
	isPageLoading,
	isFilterDisabled,
	onRefresh,
	onEndReached,
	keyExtractor,
	renderScreenHeader,
	renderSectionHeader: renderSectionHeaderProp,
	renderItem,
	renderPlaceholder,
	shouldShowFooter
}) => {
	const walletController = useWalletController();
	const { accounts, networkIdentifier, chainName, modules } = walletController;

	const renderListHeader = useCallback(() => (
		<Filter
			accounts={accounts[networkIdentifier]}
			addressBook={modules?.addressBook}
			chainName={chainName}
			networkIdentifier={networkIdentifier}
			data={filterConfig}
			isDisabled={isFilterDisabled || isRefreshing || isLoading}
			value={filterValue}
			onChange={onFilterChange}
		/>
	), [filterConfig, isFilterDisabled, isLoading, isRefreshing, filterValue, onFilterChange]);

	const renderListEmpty = useCallback(() => {
		if (isLoading || isRefreshing || isPageLoading)
			return null;

		return <EmptyListPlaceholder />;
	}, [isLoading || isRefreshing || isPageLoading]);

	const renderSectionHeader = useCallback(({ section }) => (
		<AnimatedListItem style={styles.sectionHeader}>
			{renderSectionHeaderProp 
				? renderSectionHeaderProp({ section }) 
				: <SectionHeader title={section.title} titleStyle={section.titleStyle} />
			}
		</AnimatedListItem>
	), [renderSectionHeaderProp]);

	const renderSectionFooter = useCallback(({ section }) => {
		const showFooter = shouldShowFooter?.(section.group) ?? false;
		if (!showFooter)
			return null;

		return (
			<LoadingFooter
				isLoading={isPageLoading}
				renderPlaceholder={renderPlaceholder}
			/>
		);
	}, [shouldShowFooter, isPageLoading, renderPlaceholder]);

	const renderItemWrapper = useCallback(({ item, section, index }) => (
		<AnimatedListItem style={styles.listItem}>
			{renderItem({ item, section, index })}
		</AnimatedListItem>
	), [renderItem]);

	return (
		<Screen isScrollDisabled>
			{renderScreenHeader && (
				<Screen.Header>{renderScreenHeader()}</Screen.Header>
			)}
			<Screen.Upper>
				<SectionList
					key={listKey}
					refreshControl={
						<RefreshControl
							tintColor={Colors.Components.loadingIndicator.surface}
							refreshing={isRefreshing}
							onRefresh={onRefresh}
						/>
					}
					onEndReached={onEndReached}
					onEndReachedThreshold={NEXT_PAGE_TRIGGER_THRESHOLD}
					stickySectionHeadersEnabled={false}
					contentContainerStyle={styles.listContainer}
					sections={sections}
					ListEmptyComponent={renderListEmpty}
					ListHeaderComponent={renderListHeader}
					keyExtractor={keyExtractor}
					renderItem={renderItemWrapper}
					renderSectionHeader={renderSectionHeader}
					renderSectionFooter={renderSectionFooter}
				/>
			</Screen.Upper>
		</Screen>
	);
};

const styles = StyleSheet.create({
	listContainer: {
		flexGrow: 1,
		gap: LIST_GAP
	},
	sectionHeader: {
		paddingHorizontal: LIST_PADDING
	},
	listItem: {
		paddingHorizontal: LIST_PADDING
	},
	sectionFooter: {
		position: 'relative',
		paddingHorizontal: LIST_PADDING,
		gap: LIST_GAP
	},
	loadingIndicator: {
		position: 'absolute',
		height: '100%',
		width: '100%'
	},
	emptyList: {
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center'
	},
	emptyListText: {
		textAlign: 'center',
		color: Colors.Semantic.background.tertiary.darker
	}
});
