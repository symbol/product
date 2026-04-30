import {
	AccountAvatar,
	Amount,
	Field,
	Icon,
	LoadingIndicator,
	Spacer,
	Stack,
	StyledText
} from '@/app/components';
import { $t } from '@/app/localization';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { BounceIn } from 'react-native-reanimated';
import { WalletAccountType } from 'wallet-common-core/src/constants';

const BALANCE_CHANGE_ANIMATION_DELAY = 1000;
const BALANCE_CHANGE_ANIMATION_DURATION = 250;

/**
 * RemoveButton component. Renders a touchable icon button for removing or hiding an account.
 * @param {object} props - Component props.
 * @param {string} props.type - Account type to determine which icon to display.
 * @param {function(): void} props.onPress - Callback when button is pressed.
 * @returns {React.ReactNode} RemoveButton component.
 */
const RemoveButton = ({ type, onPress }) => {
	const iconName = type === WalletAccountType.EXTERNAL ? 'delete' : 'hide';

	return (
		<TouchableOpacity onPress={onPress} hitSlop={15}>
			<Icon name={iconName} size="xs" />
		</TouchableOpacity>
	);
};

/**
 * Formats balance change value with appropriate sign prefix.
 * @param {string} value - The balance change value.
 * @returns {string} Formatted balance change with sign.
 */
const formatBalanceChange = value => {
	if (value === '0' || value.startsWith('-'))
		return value;

	return `+${value}`;
};

/**
 * BalanceChangeBadge component. Displays an animated badge showing balance change amount.
 * @param {object} props - Component props.
 * @param {string} props.value - Balance change value to display.
 * @param {string} props.ticker - Currency ticker symbol.
 * @returns {React.ReactNode} BalanceChangeBadge component.
 */
const BalanceChangeBadge = ({ value, ticker }) => {
	const formattedValue = formatBalanceChange(value);
	const animation = BounceIn
		.delay(BALANCE_CHANGE_ANIMATION_DELAY)
		.duration(BALANCE_CHANGE_ANIMATION_DURATION);
	
	return (
		<Animated.View style={styles.balanceChangeBadge} entering={animation} key={value}>
			<StyledText type="label" size="s" inverse>{`${formattedValue} ${ticker}`}</StyledText>
		</Animated.View>
	);
};

/**
 * AccountCard component. Displays account information including name, balance, and address
 * with optional loading state, active/inactive styling, and remove functionality.
 * @param {object} props - Component props.
 * @param {string} props.address - Account address to display.
 * @param {string} props.balance - Account balance amount.
 * @param {string} [props.balanceChange] - Recent balance change amount (optional).
 * @param {string} props.name - Account display name.
 * @param {boolean} [props.isLoading=false] - Whether the card is in a loading state.
 * @param {boolean} [props.isActive=false] - Whether the card is currently active/selected.
 * @param {string} [props.accountType] - Account type.
 * @param {function(): void} [props.onRemove] - Callback when remove button is pressed.
 * @returns {React.ReactNode} AccountCard component.
 */
export const AccountCard = props => {
	const {
		address,
		balance,
		balanceChange,
		name,
		isLoading = false,
		isActive = false,
		accountType,
		ticker,
		onRemove
	} = props;
	const isBalanceChangeVisible = Boolean(balanceChange && balanceChange !== '0');

	// Styles
	const rootStateStyle = isActive ? styles.root__active : styles.root__inactive;
	const rootStyle = [styles.root, rootStateStyle];

	// Handlers
	const handleRemovePress = e => {
		e?.stopPropagation?.();
		onRemove?.();
	};

	return (
		<View style={rootStyle}>
			{isLoading && (
				<LoadingIndicator size="sm" style={styles.loadingIndicator} />
			)}
			<View style={styles.header} onTouchEnd={e => e.stopPropagation()}>
				{!!onRemove && (
					<RemoveButton type={accountType} onPress={handleRemovePress} />
				)}
				<AccountAvatar size="s" address={address} />
			</View>
			<Spacer>
				<Stack>
					<Field title={$t('c_accountCard_title_account')}>
						<StyledText type="title">{name}</StyledText>
					</Field>

					<Field title={$t('c_accountCard_title_balance')}>
						<View style={styles.balanceContainer}>
							{!!isBalanceChangeVisible && (
								<BalanceChangeBadge value={balanceChange} ticker={ticker} />
							)}
						</View>
						<Amount value={balance} ticker={ticker} size="l" />
					</Field>

					<Field title={$t('c_accountCard_title_address')}>
						<StyledText>{address}</StyledText>
					</Field>
				</Stack>
			</Spacer>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		width: '100%',
		borderRadius: Sizes.Semantic.borderRadius.m,
		borderWidth: Sizes.Semantic.borderWidth.m,
		backgroundColor: Colors.Components.card.background,
		overflow: 'hidden'
	},
	root__inactive: {
		borderColor: Colors.Semantic.role.neutral.muted
	},
	root__active: {
		borderColor: Colors.Semantic.role.secondary.default
	},
	header: {
		position: 'absolute',
		top: Sizes.Semantic.spacing.m,
		right: Sizes.Semantic.spacing.m,
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.m,
		zIndex: 2
	},
	loadingIndicator: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		zIndex: 3
	},
	balanceContainer: {
		position: 'relative'
	},
	balanceChangeBadge: {
		position: 'absolute',
		top: 0,
		right: 0,
		backgroundColor: Colors.Semantic.role.danger.default,
		borderRadius: Sizes.Semantic.borderRadius.m,
		paddingHorizontal: Sizes.Semantic.spacing.s,
		zIndex: 1
	}
});
