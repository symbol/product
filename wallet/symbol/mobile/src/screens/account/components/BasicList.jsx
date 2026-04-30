import { TouchableNative } from '@/app/components';
import { Sizes } from '@/app/styles';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

/**
 * ListItem component. Wraps individual items with touch handling.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components to render.
 * @param {function(): void} props.onPress - Callback when item is pressed.
 * @returns {React.ReactNode} ListItem component.
 */
const ListItem = ({ children, onPress }) => (
	<View style={styles.itemContainer}>
		<TouchableNative onPress={onPress}>
			{children}
		</TouchableNative>
	</View>
);

/**
 * BasicList component. A wrapper around FlatList providing simplified props
 * and consistent styling for list functionality.
 * @param {object} props - Component props.
 * @param {Array} props.data - Array of items to render.
 * @param {function(object): React.ReactNode} props.renderItem - Function to render each item, receives { item }.
 * @param {function(): React.ReactNode} props.renderHeader - Function to render the component before the list.
 * @param {function(object): string} props.keyExtractor - Function to extract unique key from item.
 * @param {function(): void} props.onItemPress - Callback when an item is pressed.
 * @returns {React.ReactNode} BasicList component.
 */
export const BasicList = ({
	data,
	renderItem,
	renderHeader,
	keyExtractor,
	onItemPress
}) => {
	const headerComponent = 'function' === typeof renderHeader
		? renderHeader()
		: renderHeader;

	const renderListItem = useCallback(({ item }) => (
		<ListItem onPress={() => onItemPress?.(item)}>
			{renderItem({ item })}
		</ListItem>
	), [onItemPress, renderItem]);

	return (
		<FlatList
			ListHeaderComponent={headerComponent}
			style={styles.container}
			contentContainerStyle={styles.listContent}
			data={data}
			keyExtractor={keyExtractor}
			renderItem={renderListItem}
		/>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1
	},
	listContent: {
		padding: Sizes.Semantic.layoutPadding.m,
		gap: Sizes.Semantic.layoutSpacing.s
	},
	itemContainer: {
		borderRadius: Sizes.Semantic.borderRadius.m,
		overflow: 'hidden'
	}
});
