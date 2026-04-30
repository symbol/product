import {
	Amount,
	Card,
	CopyButtonContainer,
	DialogBox,
	EditButtonContainer,
	Field,
	Icon,
	Spacer,
	Stack,
	StyledText,
	TouchableNative
} from '@/app/components';
import { useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import { getUserCurrencyAmountText, validateAccountName, validateRequired } from '@/app/utils';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

const CARD_BACKGROUND_COLOR = Colors.Semantic.role.primary.default;
const BUTTON_BACKGROUND_COLOR = Colors.Semantic.role.primary.weaker;

const ART_HEIGHT = Sizes.Semantic.spacing.m * 25;
const ART_WIDTH = Sizes.Semantic.spacing.m * 32;
const ART_TOP_OFFSET = Sizes.Semantic.spacing.m * 7;

const CONTENT_TOP_OFFSET = Sizes.Semantic.spacing.m * 10;

/**
 * ActionButton component.
 *
 * Internal button component for AccountCardWidget action bar.
 * @param {object} props - Component props.
 * @param {string} props.icon - Icon name to display.
 * @param {string} props.text - Button label text.
 * @param {boolean} [props.isLast=false] - Whether this is the last button (no right border).
 * @param {function(): void} props.onPress - Callback when button is pressed.
 */
const ActionButton = ({ icon, text, isLast = false, onPress }) => {
	const buttonStyle = isLast ? [styles.actionButton, styles.actionButtonLast] : styles.actionButton;

	return (
		<View style={buttonStyle}>
			<TouchableNative onPress={onPress} style={styles.actionButtonPressable}>
				<Icon name={icon} size="xs" />
				<Text style={styles.actionButtonText}>{text}</Text>
			</TouchableNative>
		</View>
	);
};

/**
 * AccountCardWidget component.
 *
 * A card widget displaying account information including name, balance, and address.
 * Provides action buttons for account details, send, and swap operations.
 * @param {object} props - Component props.
 * @param {string} props.address - Account address to display.
 * @param {string} props.balance - Account balance amount.
 * @param {string} props.name - Account name.
 * @param {import('../../../types/Price').Price} props.price - Current token price for fiat conversion.
 * @param {string} props.ticker - Currency ticker symbol.
 * @param {NetworkIdentifier} props.networkIdentifier - Network identifier for currency formatting.
 * @param {function(string): void} props.onNameChange - Callback when account name is changed.
 * @param {function(): void} props.onSwapPress - Callback when swap button is pressed.
 * @param {function(): void} props.onSendPress - Callback when send button is pressed.
 * @param {function(): void} props.onDetailsPress - Callback when account details button is pressed.
 * @returns {React.ReactNode} AccountCardWidget component.
 */
export const AccountCardWidget = props => {
	const {
		address,
		balance,
		name,
		price,
		ticker,
		networkIdentifier,
		onNameChange,
		onSwapPress,
		onSendPress,
		onDetailsPress
	} = props;

	// State
	const [isNameEditShown, toggleNameEdit] = useToggle(false);

	// Validation
	const nameValidators = [validateRequired(), validateAccountName()];

	const userCurrencyBalanceText = getUserCurrencyAmountText(balance, price, networkIdentifier);

	// Handlers
	const handleNameChange = newName => {
		toggleNameEdit();
		onNameChange(newName);
	};

	return (
		<Card style={styles.root} color={CARD_BACKGROUND_COLOR}>
			<Image source={require('@/app/assets/images/art/wallet-arms.png')} style={styles.art} />
			<Spacer>
				<Stack>
					<Field title={$t('c_accountCard_title_account')}>
						<EditButtonContainer onEditPress={toggleNameEdit}>
							<StyledText type="title">
								{name}
							</StyledText>
						</EditButtonContainer>
					</Field>
					<Field title={$t('c_accountCard_title_balance')}>
						<Amount
							value={balance}
							ticker={ticker}
							size="l"
						/>
						{!!userCurrencyBalanceText && (
							<StyledText>
								{userCurrencyBalanceText}
							</StyledText>
						)}
					</Field>
					<Field title={$t('c_accountCard_title_address')}>
						<CopyButtonContainer value={address}>
							<StyledText>{address}</StyledText>
						</CopyButtonContainer>
					</Field>
				</Stack>
			</Spacer>
			<View style={styles.actionBar}>
				<ActionButton
					icon="account"
					text={$t('c_accountCard_button_accountDetails')}
					onPress={onDetailsPress}
				/>
				<ActionButton
					icon="send-plane"
					text={$t('c_accountCard_button_send')}
					onPress={onSendPress}
				/>
				<ActionButton
					icon="swap"
					text={$t('c_accountCard_button_swap')}
					isLast
					onPress={onSwapPress}
				/>
			</View>
			<DialogBox
				type="prompt"
				title={$t('c_accountCard_prompt_title')}
				text={$t('c_accountCard_prompt_text')}
				promptValidators={nameValidators}
				isVisible={isNameEditShown}
				onSuccess={handleNameChange}
				onCancel={toggleNameEdit}
			/>
		</Card >
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		width: '100%',
		marginTop: ART_TOP_OFFSET,
		paddingTop: CONTENT_TOP_OFFSET
	},
	art: {
		position: 'absolute',
		height: ART_HEIGHT,
		width: ART_WIDTH,
		right: 0,
		top: -ART_TOP_OFFSET,
		resizeMode: 'stretch'
	},
	loadingIndicator: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '150%',
		backgroundColor: Colors.Semantic.overlay.primary.default
	},
	userCurrencyText: {
		...Typography.Semantic.body.m,
		color: Colors.Components.main.text
	},
	actionBar: {
		flexDirection: 'row',
		backgroundColor: BUTTON_BACKGROUND_COLOR,
		borderBottomLeftRadius: Sizes.Semantic.borderRadius.m,
		borderBottomRightRadius: Sizes.Semantic.borderRadius.m,
		overflow: 'hidden'
	},
	actionButton: {
		height: Sizes.Semantic.controlHeight.m,
		flex: 1,
		borderRightColor: CARD_BACKGROUND_COLOR,
		borderRightWidth: Sizes.Semantic.borderWidth.s
	},
	actionButtonLast: {
		borderRightWidth: 0
	},
	actionButtonPressable: {
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center',
		flexDirection: 'row',
		gap: Sizes.Semantic.spacing.s
	},
	actionButtonText: {
		...Typography.Semantic.button.m,
		fontSize: Typography.Semantic.button.m * 0.9,
		color: Colors.Components.buttonCardEmbedded.primary.default.text
	}
});
