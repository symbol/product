import {
	Amount,
	Card,
	CopyView,
	DialogBox,
	EditViewContainer,
	Field,
	Icon,
	Spacer,
	Stack,
	StyledText,
	TouchableNative
} from '@/app/components';
import { config } from '@/app/config';
import { useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import { getUserCurrencyAmountText, validateAccountName, validateRequired } from '@/app/utils';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const CARD_BACKGROUND_COLOR = Colors.Semantic.role.primary.default;
const BUTTON_BACKGROUND_COLOR = Colors.Semantic.role.primary.weaker;
const BUTTON_BACKGROUND_COLOR_PRESSED = Colors.Semantic.role.primary.muted;

/**
 * ActionButton component
 *
 * Internal button component for AccountCardWidget action bar.
 *
 * @param {object} props - Component props
 * @param {string} props.icon - Icon name to display.
 * @param {string} props.text - Button label text.
 * @param {boolean} [props.isLast=false] - Whether this is the last button (no right border).
 * @param {function} props.onPress - Callback when button is pressed.
 */
const ActionButton = ({ icon, text, isLast = false, onPress }) => {
	const buttonStyle = isLast ? [styles.actionButton, styles.actionButtonLast] : styles.actionButton;

	return (
		<View style={buttonStyle}>
			<TouchableNative
				color={BUTTON_BACKGROUND_COLOR}
				colorPressed={BUTTON_BACKGROUND_COLOR_PRESSED}
				onPress={onPress}
				style={styles.actionButtonPressable}
			>
				<Icon name={icon} size="xs" />
				<Text style={styles.actionButtonText}>{text}</Text>
			</TouchableNative>
		</View>
	);
};

/**
 * AccountCardWidget component
 *
 * A card widget displaying account information including name, balance, and address.
 * Provides action buttons for account details, send, and receive operations.
 *
 * @param {object} props - Component props
 * @param {string} props.address - Account address to display.
 * @param {string} props.balance - Account balance amount.
 * @param {string} props.name - Account name.
 * @param {import('../../../types/Price').Price} props.price - Current token price for fiat conversion.
 * @param {string} props.networkIdentifier - Network identifier for currency formatting.
 * @param {function} props.onNameChange - Callback when account name is changed.
 * @param {function} props.onReceivePress - Callback when receive button is pressed.
 * @param {function} props.onSendPress - Callback when send button is pressed.
 * @param {function} props.onDetailsPress - Callback when account details button is pressed.
 *
 * @returns {React.ReactNode} AccountCardWidget component
 */
export const AccountCardWidget = props => {
	const {
		address,
		balance,
		name,
		price,
		networkIdentifier,
		onNameChange,
		onReceivePress,
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
						<EditViewContainer onEditPress={toggleNameEdit}>
							<StyledText type="title">
								{name}
							</StyledText>
						</EditViewContainer>
					</Field>
					<Field title={$t('c_accountCard_title_balance')}>
						<Amount
							value={balance}
							ticker={config.chains.symbol.ticker}
							size="l"
						/>
						{!!userCurrencyBalanceText && (
							<StyledText>
								{userCurrencyBalanceText}
							</StyledText>
						)}
					</Field>
					<Field title={$t('c_accountCard_title_address')}>
						<CopyView value={address} />
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
					icon="receive"
					text={$t('c_accountCard_button_receive')}
					isLast
					onPress={onReceivePress}
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
		marginTop: 58,
		paddingTop: 81
	},
	art: {
		position: 'absolute',
		height: 201,
		width: 260,
		right: 0,
		top: -58,
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
		fontSize: 15,
		color: Colors.Components.buttonCardEmbedded.primary.default.text
	}
});
