import { DropdownModal, Icon, InputAddressDropdown, TouchableNative } from '@/app/components';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import { FilterType } from '@/app/types/Filter';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

const DISABLED_OPACITY = 0.7;

/**
 * @typedef {import('@/app/types/Filter').FilterItem} FilterItem
 */

/**
 * @typedef {import('@/app/types/Filter').FilterValue} FilterValue
 */

/**
 * FilterChip component. A filter list item button.
 *
 * @param {object} props - Component props
 * @param {string} props.title - Chip display text
 * @param {boolean} [props.isActive=false] - Whether the chip is in active state
 * @param {boolean} [props.isDisabled=false] - Whether the chip is disabled
 * @param {React.ReactNode} [props.iconLeft] - Optional icon to display on the left
 * @param {function} props.onPress - Callback fired on press
 * 
 * @returns {React.ReactNode} FilterChip component
 */
const FilterChip = ({ title, isActive = false, isDisabled = false, iconLeft, onPress }) => {
	// Color and style animations
	const color = isActive 
		? Colors.Components.chip.active
		: Colors.Components.chip.default;
	const colorPressed = Colors.Components.chip.pressed;
	const textStyles = [styles.chipText, { color: color.text } ];

	// Handlers
	const handlePress = e => {
		e?.stopPropagation?.();
		if (isDisabled) 
			return;
		onPress?.();
	};

	return (
		<TouchableNative
			onPress={handlePress} 
			color={color.background}
			colorPressed={colorPressed.background}
			disabled={isDisabled}
			containerStyle={[styles.chip, isDisabled && styles.chip__disabled]}
		>
			<View style={styles.chipContent}>
				{iconLeft}
				<Text style={textStyles}>
					{title}
				</Text>
			</View>
		</TouchableNative>
	);
};

/**
 * ClearFilterChip component. A filter clear button.
 *
 * @param {object} props - Component props
 * @param {boolean} [props.isDisabled=false] - Whether the chip is disabled
 * @param {function} props.onPress - Callback fired on press
 * 
 * @returns {React.ReactNode} ClearFilterChip component
 */
const ClearFilterChip = ({ isDisabled = false, onPress }) => (
	<FilterChip
		title={$t('button_clear')}
		isDisabled={isDisabled}
		iconLeft={<Icon name="cross-circle" size="xs" variant="secondary" />}
		onPress={onPress}
	/>
);

/**
 * Filter component. A horizontal scrollable list of filter chips that supports boolean toggles,
 * dropdown selections, and address input filters with modal interfaces.
 *
 * @param {object} props - Component props
 * @param {FilterItem[]} props.data - Array of filter configuration items
 * @param {FilterValue} props.value - Current filter values as key-value pairs
 * @param {boolean} [props.isDisabled=false] - Whether all filters are disabled
 * @param {object} [props.addressBook] - Address book instance for address filters
 * @param {Array} [props.accounts] - List of wallet accounts for address filters
 * @param {string} [props.chainName] - Blockchain name for address resolution
 * @param {string} [props.networkIdentifier] - Network identifier for address resolution
 * @param {function} props.onChange - Callback when filter values change
 *
 * @returns {React.ReactNode} Filter component
 */
export const Filter = props => {
	const { 
		data, 
		value, 
		isDisabled = false, 
		addressBook, 
		accounts,
		chainName, 
		networkIdentifier, 
		onChange 
	} = props;
	const [expandedFilter, setExpandedFilter] = useState(null);

	// Filter state helpers
	const isFilterActive = name => !!value[name];
	const isFilterAvailable = name => 
		(Object.keys(value).length === 0 || Object.prototype.hasOwnProperty.call(value, name)) && !isDisabled;

	// Handlers
	const handleClear = () => Object.keys(value).length !== 0 && onChange({});

	const handleFilterPress = filter => {
		if (filter.type === FilterType.BOOLEAN)
			handleFilterValueChange(filter, !value[filter.name]);
		else
			setExpandedFilter(filter);
	};

	const handleFilterValueChange = (filter, filterValue) => {
		const updatedValues = { ...value };

		if (filterValue)
			updatedValues[filter.name] = filterValue;
		else
			delete updatedValues[filter.name];
		
		onChange(updatedValues);
	};

	const handleModalClose = () => setExpandedFilter(null);

	// Render helpers
	const renderFilterChip = ({ item }) => (
		<View style={styles.chipWrapper}>
			<FilterChip
				title={item.title}
				isActive={isFilterActive(item.name)}
				isDisabled={!isFilterAvailable(item.name)}
				onPress={() => handleFilterPress(item)}
			/>
		</View>
	);

	const renderClearChip = () => (
		<View style={styles.chipWrapper}>
			<ClearFilterChip isDisabled={isDisabled} onPress={handleClear} />
		</View>
	);

	const keyExtractor = (_, index) => `filter-${index}`;

	return (
		<View>
			<FlatList
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.root}
				contentContainerStyle={styles.list}
				data={data}
				keyExtractor={keyExtractor}
				renderItem={renderFilterChip}
				ListHeaderComponent={renderClearChip}
			/>
			{expandedFilter?.type === FilterType.SELECT && (
				<DropdownModal
					isOpen
					title={expandedFilter.title}
					list={expandedFilter.options}
					value={value[expandedFilter.name]}
					onChange={filterValue => handleFilterValueChange(expandedFilter, filterValue)}
					onClose={handleModalClose}
				/>
			)}
			{expandedFilter?.type === FilterType.ADDRESS && (
				<InputAddressDropdown
					isOpen
					title={expandedFilter.title}
					value={value[expandedFilter.name]}
					addressBook={addressBook}
					accounts={accounts}
					chainName={chainName}
					networkIdentifier={networkIdentifier}
					onChange={filterValue => handleFilterValueChange(expandedFilter, filterValue)}
					onClose={handleModalClose}
				/>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		width: '100%'
	},
	list: {
		paddingVertical: Sizes.Semantic.spacing.m,
		paddingLeft: Sizes.Semantic.spacing.m
	},
	chipWrapper: {
		marginRight: Sizes.Semantic.spacing.m
	},
	chip: {
		overflow: 'hidden',
		height: Sizes.Semantic.spacing.xl,
		borderRadius: Sizes.Semantic.borderRadius.l,
		paddingHorizontal: Sizes.Semantic.spacing.m,
		justifyContent: 'center',
		alignItems: 'center'
	},
	chip__disabled: {
		opacity: DISABLED_OPACITY
	},
	chipContent: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.s
	},
	chipText: {
		...Typography.Semantic.label.m
	}
});
