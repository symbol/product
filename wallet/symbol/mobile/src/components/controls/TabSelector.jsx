import { TouchableNative } from '@/app/components';
import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * @typedef {Object} TabItem
 * @property {*} value - Unique identifier for the tab
 * @property {string} label - Display text for the tab
 */

const BORDER_WIDTH = Sizes.Semantic.borderWidth.m;
const BORDER_COLOR = Colors.Components.tabSelector.default.border;

/**
 * TabSelectorItem component. Individual tab button within the selector.
 *
 * @param {object} props - Component props
 * @param {string} props.label - Tab display text
 * @param {boolean} props.isActive - Whether this tab is currently selected
 * @param {boolean} props.isDisabled - Whether this tab is disabled
 * @param {function} props.onPress - Callback fired on tab press
 *
 * @returns {React.ReactNode} TabSelectorItem component
 */
const TabSelectorItem = ({ label, isActive, isDisabled, onPress }) => {
	const colors = isActive
		? Colors.Components.tabSelector.active
		: Colors.Components.tabSelector.default;
	const colorPressed = Colors.Components.tabSelector.pressed.background;
	const textStyle = [styles.itemText, { color: colors.text }];

	const handlePress = e => {
		e?.stopPropagation?.();
		if (isDisabled) return;
		onPress?.();
	};

	return (
		<TouchableNative
			containerStyle={styles.item}
			style={styles.itemContent}
			color={colors.background}
			colorPressed={colorPressed}
			disabled={isDisabled}
			onPress={handlePress}
		>
			<Text style={textStyle}>{label}</Text>
		</TouchableNative>
	);
};

/**
 * TabSelector component. A horizontal tab control that displays a group of selectable options
 * as connected buttons, with a border around the group and dividers between tabs.
 * Rounded corners appear only on the outer edges.
 *
 * @param {object} props - Component props
 * @param {TabItem[]} props.list - Array of tab items with value and label properties
 * @param {*} props.value - Currently selected tab value
 * @param {boolean} [props.isDisabled=false] - Whether the entire selector is disabled
 * @param {object} [props.style] - Additional styles for the container
 * @param {function} props.onChange - Callback when selected tab changes, receives the new value
 *
 * @returns {React.ReactNode} TabSelector component
 */
export const TabSelector = ({ list, value, isDisabled = false, style, onChange }) => {
	const handleTabPress = tabValue => {
		if (tabValue === value) return;
		onChange?.(tabValue);
	};

	return (
		<View style={[styles.root, style]}>
			{list.map((item, index) => (
				<React.Fragment key={`tab-${item.value}`}>
					{index > 0 && <View style={styles.separator} />}
					<TabSelectorItem
						label={item.label}
						isActive={item.value === value}
						isDisabled={isDisabled}
						onPress={() => handleTabPress(item.value)}
					/>
				</React.Fragment>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		height: Sizes.Semantic.controlHeight.s,
		borderRadius: Sizes.Semantic.borderRadius.s,
		borderWidth: BORDER_WIDTH,
		borderColor: BORDER_COLOR,
		overflow: 'hidden'
	},
	item: {
		flex: 1,
		overflow: 'hidden'
	},
	itemContent: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	},
	itemText: {
		...Typography.Semantic.button.m
	},
	separator: {
		width: BORDER_WIDTH,
		backgroundColor: BORDER_COLOR
	}
});
