import {
	AccountAvatar,
	Amount,
	Button,
	Field,
	Spacer,
	Stack,
	StyledText
} from '@/app/components';
import { $t } from '@/app/localization';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * BridgeAccountCard component. Displays bridge account information including chain name,
 * balance, and address. Shows an activation button for inactive accounts.
 * @param {Object} props - Component props.
 * @param {string} [props.address] - Account address to display.
 * @param {string} props.balance - Account balance amount.
 * @param {string} props.name - Account display name (chain name).
 * @param {string} props.ticker - Currency ticker symbol.
 * @param {boolean} [props.isActive=false] - Whether the account is currently active.
 * @param {() => void} [props.onActivate] - Callback when activate button is pressed.
 * @returns {React.ReactNode} BridgeAccountCard component
 */
export const BridgeAccountCard = props => {
	const {
		address,
		balance,
		name,
		isActive = false,
		ticker,
		onActivate
	} = props;

	const isAddressVisible = isActive;
	const isAccountAvatarVisible = isActive;
	const isActivateButtonVisible = !isActive;

	// Handlers
	const handleActivatePress = e => {
		e?.stopPropagation?.();
		onActivate?.();
	};

	return (
		<View style={styles.root}>
			{isAccountAvatarVisible && (
				<View style={styles.header}>
					<AccountAvatar size="s" address={address} />
				</View>
			)}
			<Spacer>
				<Stack>
					<Field title={$t('c_accountCard_title_account')}>
						<StyledText type="title">{name}</StyledText>
					</Field>

					<Field title={$t('c_accountCard_title_balance')}>
						<Amount value={balance} ticker={ticker} size="l" />
					</Field>

					{isAddressVisible && (
						<Field title={$t('c_accountCard_title_address')}>
							<StyledText>{address}</StyledText>
						</Field>
					)}

					{isActivateButtonVisible && (
						<Button
							type="solid"
							text={$t('button_activateAccount')}
							onPress={handleActivatePress}
						/>
					)}
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
		backgroundColor: Colors.Components.card.background,
		overflow: 'hidden'
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
	}
});
