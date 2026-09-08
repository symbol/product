import { DropdownModal, ListItemContainer, LoadingIndicator, StyledText, TokenBalanceRow } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import { useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown, FadeOutUp } from 'react-native-reanimated'; // eslint-disable-line import/order

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').SwapSideOption} SwapSideOption */
/** @typedef {import('@/app/screens/bridge/types/ViewModel').SwapSelectorViewModel} SwapSelectorViewModel */

const ICON_SWAP_REVERSE = require('@/app/assets/images/components/swap-reverse.png');
const REVERSE_BUTTON_SIZE = Sizes.Semantic.spacing.m * 5;

/**
 * TokenItem component. Shows a side option including its balance, chain, label, and avatar.
 * @param {object} props - Component props.
 * @param {SwapSideOption} props.option - The option to display.
 * @returns {import('react').ReactNode} TokenItem component.
 */
const TokenItem = ({ option }) => (
	<TokenBalanceRow
		name={option.label}
		amount={option.amount}
		imageId={option.imageId}
		size="l"
		titleCaption={(
			<StyledText type="label" variant="secondary">
				{option.chainName}
			</StyledText>
		)}
	/>
);

/**
 * SelectTokenDropdown component. Dropdown modal used to select a side option.
 * @param {object} props - Component props.
 * @param {string} props.title - Dropdown title.
 * @param {SwapSideOption} props.value - Currently selected option.
 * @param {boolean} props.isOpen - Whether dropdown is open.
 * @param {SwapSideOption[]} props.options - Selectable options.
 * @param {(side: SwapSide) => void} props.onChange - Called with the chosen option's side.
 * @param {() => void} props.onClose - Close handler.
 * @returns {import('react').ReactNode} SelectTokenDropdown component.
 */
const SelectTokenDropdown = props => {
	const { title, value, isOpen, options, onChange, onClose } = props;

	const handleChange = key => {
		const selectedOption = options.find(option => option.key === key);
		onChange(selectedOption.side);
	};

	const dropdownOptionsList = options.map(option => ({
		...option,
		value: option.key
	}));

	// Items renderer
	const renderItem = ({ item }) => <TokenItem option={item} />;

	return (
		<DropdownModal
			title={title}
			value={value.key}
			list={dropdownOptionsList}
			isOpen={isOpen}
			onChange={handleChange}
			onClose={onClose}
			renderItem={renderItem}
		/>
	);
};

/**
 * TokenSelect component. Shows the chosen option and allows changing it via tap.
 * @param {object} props - Component props.
 * @param {SwapSideOption|null} props.value - Selected option; null renders the empty placeholder.
 * @param {SwapSideOption[]} props.options - Selectable options.
 * @param {string} props.accessibilityLabel - Accessibility label for the touchable element.
 * @param {(side: SwapSide) => void} props.onChange - Selection change handler.
 * @returns {import('react').ReactNode} TokenSelect component.
 */
const TokenSelect = ({ value, options, accessibilityLabel, onChange }) => {
	// Visibility state of dropdown
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const openDropdown = () => setIsDropdownOpen(true);
	const closeDropdown = () => setIsDropdownOpen(false);

	if (!value)
		return <ListItemContainer cardStyle={{ opacity: 0.3 }} accessibilityLabel={accessibilityLabel} />;

	return (
		<>
			<ListItemContainer onPress={openDropdown} accessibilityLabel={accessibilityLabel}>
				<TokenItem option={value} />
			</ListItemContainer>
			<SelectTokenDropdown
				title="Select Token"
				value={value}
				isOpen={isDropdownOpen}
				options={options}
				onChange={onChange}
				onClose={closeDropdown}
			/>
		</>
	);
};

/**
 * ReverseButton component. Button for swapping the target and source.
 * @param {object} props - Component props.
 * @param {boolean} props.isLoading - Whether swap is loading.
 * @param {() => void} props.onPress - Press handler.
 * @returns {import('react').ReactNode} ReverseButton component.
 */
const ReverseButton = ({ isLoading, onPress }) => {
	return (
		<TouchableOpacity
			onPress={onPress}
			style={styles.reverseButton}
			disabled={isLoading}
			accessibilityLabel="Reverse swap direction"
		>
			{!isLoading && <Image source={ICON_SWAP_REVERSE} style={styles.reverseIcon} />}
			{isLoading && <LoadingIndicator size="sm" />}
		</TouchableOpacity>
	);
};

/**
 * SwapSelector component. Displays the swap side tokens and allows to select them from options.
 * @param {object} props - Component props.
 * @param {boolean} props.isLoading - Whether data is loading.
 * @param {SwapSelectorViewModel} props.selector - Selected options and the selectable options.
 * @param {(side: SwapSide) => void} props.onSourceChange - Source change handler.
 * @param {(side: SwapSide) => void} props.onTargetChange - Target change handler.
 * @param {() => void} props.onReverse - Swaps source and target.
 * @returns {import('react').ReactNode} SwapSelector component.
 */
export const SwapSelector = ({
	isLoading,
	selector,
	onSourceChange,
	onTargetChange,
	onReverse
}) => {
	return (
		<View style={styles.root}>
			<Animated.View
				entering={FadeInDown}
				exiting={FadeOutDown}
				key={`source-${selector.source?.key}`}
			>
				<TokenSelect
					value={selector.source}
					options={selector.sourceOptions}
					accessibilityLabel="Select source token"
					onChange={onSourceChange}
				/>
			</Animated.View>
			<ReverseButton isLoading={isLoading} onPress={onReverse} />
			<Animated.View
				entering={FadeInUp}
				exiting={FadeOutUp}
				key={`target-${selector.target?.key}`}
			>
				<TokenSelect
					value={selector.target}
					options={selector.targetOptions}
					accessibilityLabel="Select target token"
					onChange={onTargetChange}
				/>
			</Animated.View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		flexDirection: 'column',
		gap: Sizes.Semantic.spacing.l
	},
	reverseButton: {
		position: 'absolute',
		top: '50%',
		left: '50%',
		width: REVERSE_BUTTON_SIZE,
		height: REVERSE_BUTTON_SIZE,
		transform: [{ translateX: -REVERSE_BUTTON_SIZE / 2 }, { translateY: -REVERSE_BUTTON_SIZE / 2 }],
		zIndex: 1,
		backgroundColor: Colors.Components.main.background,
		borderRadius: REVERSE_BUTTON_SIZE / 2
	},
	reverseIcon: {
		width: '100%',
		height: '100%'
	}
});
