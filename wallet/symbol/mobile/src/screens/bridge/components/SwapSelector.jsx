import { Amount, DropdownModal, ListItemContainer, LoadingIndicator, StyledText, TokenAvatar } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import { getTokenKnownInfo } from '@/app/utils';
import { useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown, FadeOutUp } from 'react-native-reanimated'; // eslint-disable-line import/order

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapToken} SwapToken */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

const ICON_SWAP_REVERSE = require('@/app/assets/images/components/swap-reverse.png');
const REVERSE_BUTTON_SIZE = Sizes.Semantic.spacing.m * 5;

/**
 * TokenItem component. Displays token info with avatar, name, and balance.
 * @param {Object} props - Component props.
 * @param {SwapToken} props.token - Token data.
 * @param {string} props.chainName - Chain name.
 * @param {NetworkIdentifier} props.networkIdentifier - Network identifier.
 * @returns {import('react').ReactNode} TokenItem component
 */
const TokenItem = ({ token, chainName, networkIdentifier }) => {
	// Resolve value token info for name, ticker and image
	const resolvedTokenInfo = getTokenKnownInfo(
		chainName,
		networkIdentifier,
		token.id
	);

	// Name
	const name = resolvedTokenInfo.name ?? token.name;
	const { ticker } = resolvedTokenInfo;
	const nameText = !ticker
		? name
		: `${name} • ${ticker}`;

	return (
		<View style={styles.tokenItem}>
			<TokenAvatar imageId={resolvedTokenInfo.imageId} size="l" />
			<View style={styles.tokenTextContainer}>
				<View style={styles.tokenTitleRow}>
					<StyledText>
						{nameText}
					</StyledText>
					<StyledText type="label" variant="secondary">
						{chainName}
					</StyledText>
				</View>
				<Amount size="l" value={token.amount} />
			</View>
		</View>
	);
};

/**
 * SelectTokenDropdown component. Dropdown modal for selecting tokens.
 * @param {Object} props - Component props.
 * @param {string} props.title - Dropdown title.
 * @param {SwapSide} props.value - Currently selected value.
 * @param {boolean} props.isOpen - Whether dropdown is open.
 * @param {SwapSide[]} props.list - Available options.
 * @param {(item: SwapSide) => void} props.onChange - Selection change handler.
 * @param {() => void} props.onClose - Close handler.
 * @returns {import('react').ReactNode} SelectTokenDropdown component
 */
const SelectTokenDropdown = props => {
	const { title, value, isOpen, list, onChange, onClose } = props;

	// Prepare dropdown value and options list
	const dropdownValue = `${value.chainName}|${value.token.id}`;

	const handleChange = chainAndTokenId => {
		const [chainName, tokenId] = chainAndTokenId.split('|');
		const selectedItem = list.find(item => item.chainName === chainName && item.token.id === tokenId);
		onChange(selectedItem);
	};

	const dropdownOptionsList = list.map(item => ({
		...item,
		value: `${item.chainName}|${item.token.id}`
	}));

	// Items renderer
	const renderItem = ({ item }) => (
		<TokenItem
			token={item.token}
			chainName={item.chainName}
			networkIdentifier={item.networkIdentifier}
		/>
	);

	return (
		<DropdownModal
			title={title}
			value={dropdownValue}
			list={dropdownOptionsList}
			isOpen={isOpen}
			onChange={handleChange}
			onClose={onClose}
			renderItem={renderItem}
		/>
	);
};

/**
 * TokenSelect component. Displays selected token with tap to change.
 * @param {Object} props - Component props.
 * @param {SwapSide|null} props.value - Selected swap side.
 * @param {SwapSide[]} props.list - Available options.
 * @param {string} props.accessibilityLabel - Accessibility label for the touchable element.
 * @param {(item: SwapSide) => void} props.onChange - Selection change handler.
 * @returns {import('react').ReactNode} TokenSelect component
 */
const TokenSelect = ({ value, list, accessibilityLabel, onChange }) => {
	// Dropdown visibility state
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const openDropdown = () => setIsDropdownOpen(true);
	const closeDropdown = () => setIsDropdownOpen(false);

	if (!value)
		return <ListItemContainer cardStyle={{ opacity: 0.3 }} accessibilityLabel={accessibilityLabel} />;

	return (
		<ListItemContainer onPress={openDropdown} accessibilityLabel={accessibilityLabel}>
			<TokenItem
				token={value.token}
				chainName={value.chainName}
				networkIdentifier={value.networkIdentifier}
			/>
			<SelectTokenDropdown
				title="Select Token"
				value={value}
				isOpen={isDropdownOpen}
				list={list}
				onChange={onChange}
				onClose={closeDropdown}
			/>
		</ListItemContainer>
	);
};

/**
 * ReverseButton component. Button to swap source and target.
 * @param {Object} props - Component props.
 * @param {boolean} props.isLoading - Whether swap is loading.
 * @param {() => void} props.onPress - Press handler.
 * @returns {import('react').ReactNode} ReverseButton component
 */
const ReverseButton = ({ isLoading, onPress }) => {
	return (
		<TouchableOpacity
			onPress={onPress}
			style={styles.reverseButton}
			disabled={isLoading}
		>
			{!isLoading && <Image source={ICON_SWAP_REVERSE} style={styles.reverseIcon} />}
			{isLoading && <LoadingIndicator size="sm" />}
		</TouchableOpacity>
	);
};

/**
 * SwapSelector component. Provides source and target token selection with reverse functionality.
 * Allows users to select tokens for swap and reverse the swap direction.
 * @param {Object} props - Component props.
 * @param {boolean} props.isLoading - Whether data is loading.
 * @param {SwapSide|null} props.source - Selected source side.
 * @param {SwapSide|null} props.target - Selected target side.
 * @param {SwapSide[]} props.sourceList - Available source options.
 * @param {SwapSide[]} props.targetList - Available target options.
 * @param {(side: SwapSide) => void} props.onSourceChange - Source change handler.
 * @param {(side: SwapSide) => void} props.onTargetChange - Target change handler.
 * @returns {import('react').ReactNode} SwapSelector component
 */
export const SwapSelector = ({
	isLoading,
	source,
	target,
	sourceList,
	targetList,
	onSourceChange,
	onTargetChange
}) => {
	const reverse = () => {
		onSourceChange(target);
		onTargetChange(source);
	};

	return (
		<View style={styles.root}>
			<Animated.View
				entering={FadeInDown}
				exiting={FadeOutDown}
				key={`source-${source?.token.id}`}
			>
				<TokenSelect
					value={source}
					list={sourceList}
					accessibilityLabel="Select source token"
					onChange={onSourceChange}
				/>
			</Animated.View>
			<ReverseButton isLoading={isLoading} onPress={reverse} />
			<Animated.View
				entering={FadeInUp}
				exiting={FadeOutUp}
				key={`target-${target?.token.id}`}
			>
				<TokenSelect
					value={target}
					list={targetList}
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
	tokenItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.m,
		flex: 1
	},
	tokenTextContainer: {
		flex: 1,
		justifyContent: 'center'
	},
	tokenTitleRow: {
		flexDirection: 'row',
		justifyContent: 'space-between'
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
