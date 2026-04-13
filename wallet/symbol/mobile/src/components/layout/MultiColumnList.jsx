import { Sizes } from '@/app/styles';
import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

const DEFAULT_COLUMNS = 2;
const DEFAULT_GAP = 's';
const DEFAULT_PADDING = 'm';

/**
 * MultiColumnList component. A generic multi-column list using FlatList with flexbox layout.
 * Supports configurable number of columns and delegates item rendering to the caller.
 *
 * @param {object} props - Component props
 * @param {Array} props.data - Array of items to render.
 * @param {function} props.renderItem - Function to render each item, receives { item, index }.
 * @param {function} props.keyExtractor - Function to extract unique key from item.
 *  * @param {function|React.ReactNode} [props.renderHeader] - Component rendered before the list.
 * @param {number} [props.columns=2] - Number of columns in the grid.
 * @param {string} [props.gap='s'] - Gap size between columns and rows.
 * @param {string} [props.paddingX='m'] - Horizontal padding for the list content.
 * @param {string} [props.paddingY='m'] - Vertical padding for the list content.
 *
 * @returns {React.ReactNode} MultiColumnList component
 */
export const MultiColumnList = ({ 
	data,
	renderItem, 
	keyExtractor,
	renderHeader,
	columns = DEFAULT_COLUMNS, 
	gap = DEFAULT_GAP, 
	paddingX = DEFAULT_PADDING, 
	paddingY = DEFAULT_PADDING 
}) => {
	const spacing = Sizes.Semantic.layoutSpacing[gap];
	const contentContainerStyle = {
		paddingHorizontal: Sizes.Semantic.layoutSpacing[paddingX],
		paddingVertical: Sizes.Semantic.layoutSpacing[paddingY]
	};
	const columnWrapperStyle = {
		gap: spacing,
		marginBottom: spacing
	};

	const headerComponent = 'function' === typeof renderHeader ? renderHeader() : renderHeader;

	const renderListItem = useCallback(({ item, index }) => (
		<View style={styles.itemContainer}>
			{renderItem({ item, index })}
		</View>
	), [renderItem]);

	return (
		<FlatList
			data={data}
			renderItem={renderListItem}
			keyExtractor={keyExtractor}
			numColumns={columns}
			columnWrapperStyle={columns > 1 ? columnWrapperStyle : undefined}
			ListHeaderComponent={headerComponent}
			contentContainerStyle={contentContainerStyle}
			style={styles.list}
			showsVerticalScrollIndicator={false}
		/>
	);
};

const styles = StyleSheet.create({
	list: {
		width: '100%',
		height: '100%'
	},
	itemContainer: {
		flex: 1,
		minWidth: 0
	}
});
