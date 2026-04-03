import { TouchableNative } from '@/app/components';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { Sizes } from '@/app/styles';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import ReorderableList, { reorderItems, useReorderableDrag } from 'react-native-reorderable-list';

const LONG_PRESS_DELAY = 250;

/**
 * DraggableListItem component. Wraps individual items with touch and animation handling.
 * Must be used inside ReorderableList as it uses the useReorderableDrag hook.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render.
 * @param {function} props.onPress - Callback when item is pressed.
 *
 * @returns {React.ReactNode} DraggableListItem component
 */
const DraggableListItem = ({ children, onPress }) => {
	const drag = useReorderableDrag();

	const handleLongPress = () => {
		drag();
		PlatformUtils.vibrate();
	};

	return (
		<View style={styles.itemContainer}>
			<TouchableNative
				onPress={onPress}
				onLongPress={handleLongPress}
				delayLongPress={LONG_PRESS_DELAY}
			>
				{children}
			</TouchableNative>
		</View>
	);
};

/**
 * DraggableList component. A wrapper around ReorderableList providing simplified props
 * and consistent styling for drag-and-drop list functionality.
 *
 * @param {object} props - Component props
 * @param {Array} props.data - Array of items to render.
 * @param {function} props.renderItem - Function to render each item, receives { item }.
 * @param {function} props.keyExtractor - Function to extract unique key from item.
 * @param {function} props.onItemPress - Callback when an item is pressed.
 * @param {function} props.onOrderChange - Callback when items are reordered, receives new data array.
 *
 * @returns {React.ReactNode} DraggableList component
 */
export const DraggableList = ({
	data,
	renderItem,
	keyExtractor,
	onItemPress,
	onOrderChange
}) => {
	const handleReorder = useCallback(({ from, to }) => {
		const newData = reorderItems(data, from, to);
		PlatformUtils.vibrate();
		onOrderChange?.(newData);
	}, [data, onOrderChange]);

	const renderListItem = useCallback(({ item }) => (
		<DraggableListItem onPress={() => onItemPress?.(item)}>
			{renderItem({ item })}
		</DraggableListItem>
	), [onItemPress, renderItem]);

	return (
		<ReorderableList
			contentContainerStyle={styles.listContent}
			style={styles.container}
			data={data}
			cellAnimations={{ opacity: 1 }}
			keyExtractor={keyExtractor}
			onReorder={handleReorder}
			renderItem={renderListItem}
		/>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1
	},
	listContent: {
		padding: Sizes.Semantic.layoutPadding.m
	},
	itemContainer: {
		borderRadius: Sizes.Semantic.borderRadius.m,
		overflow: 'hidden',
		marginBottom: Sizes.Semantic.layoutSpacing.s
	}
});
