import { NemRouter } from '../../../router/NemRouter';
import { Card, Icon, Spacer, TouchableNative } from '@/app/components';
import { $t } from '@/app/localization';
import { AccountCardContent } from '@/app/screens/home/components/AccountCardContent';
import { Colors, Shadows, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

/** @typedef {import('@/app/screens/home/types/Home').AccountCardWidgetProps} AccountCardWidgetProps */

const CARD_BACKGROUND_COLOR = Colors.Components.accountCardWidgetBody.background;
const BUTTON_BACKGROUND_COLOR = Colors.Components.accountCardWidgetButton.default.background;
const BUTTON_SEPARATOR_COLOR = Colors.Components.accountCardWidgetButton.default.separator;
const BUTTON_TEXT_COLOR = Colors.Components.accountCardWidgetButton.default.text;
const BUTTON_BACKGROUND_COLOR_DISABLED = Colors.Components.accountCardWidgetButton.disabled.background;

const ART_SIZE = Sizes.Semantic.spacing.m * 64;
const ART_TOP_OFFSET = Sizes.Semantic.spacing.xl;
const ART_OPACITY = 0.5;

const BORDER_RADIUS = Sizes.Components.accountCardWidget.borderRadius;

/**
 * An internal button component used by the AccountCardWidget action bar, displaying an icon with a text label.
 * @param {object} props - Component props.
 * @param {string} props.icon - Icon name to display.
 * @param {string} props.text - Button label text.
 * @param {boolean} [props.isLast=false] - Whether this is the last button (no right border).
 * @param {boolean} [props.isDisabled=false] - Whether this button is disabled.
 * @param {function(): void} props.onPress - Callback when button is pressed.
 * @returns {React.ReactNode} ActionButton component.
 */
const ActionButton = ({ icon, text, isLast = false, isDisabled = false, onPress }) => {
	const buttonStyle = [
		styles.actionButton,
		isLast && styles.actionButtonLast,
		isDisabled && styles.actionButton__disabled
	];
	const pressableStyle = [styles.actionButtonPressable, isDisabled && styles.actionButtonPressable__disabled];

	return (
		<View style={buttonStyle}>
			<TouchableNative onPress={onPress} disabled={isDisabled} style={pressableStyle}>
				<Icon name={icon} size="xs" variant="inverse" />
				<Text style={styles.actionButtonText}>{text}</Text>
			</TouchableNative>
		</View>
	);
};

/**
 * AccountCardWidget component. A card widget displaying the account name, balance, and address,
 * with action buttons for account details and send operations.
 * @param {AccountCardWidgetProps} props - Component props.
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
		isMultisig = false,
		onNameChange
	} = props;

	return (
		<Card style={styles.root} color={CARD_BACKGROUND_COLOR}>
			<Image source={require('../../../assets/images/art/nem-logo.png')} style={styles.art} />
			<Spacer x="m" y="l">
				<AccountCardContent
					address={address}
					balance={balance}
					name={name}
					price={price}
					ticker={ticker}
					networkIdentifier={networkIdentifier}
					textColorVariant="inverse"
					onNameChange={onNameChange}
				/>
			</Spacer>
			<View style={styles.actionBar}>
				<ActionButton
					icon="account"
					text={$t('screen_home_button_accountDetails')}
					onPress={() => NemRouter.goToAccountDetails()}
				/>
				<ActionButton
					icon="send-plane"
					text={$t('screen_home_button_send')}
					isLast
					isDisabled={isMultisig}
					onPress={() => NemRouter.goToSend()}
				/>
			</View>
		</Card>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		width: '100%',
		marginTop: Sizes.Semantic.spacing.m,
		borderRadius: BORDER_RADIUS,
		overflow: 'hidden',
		boxShadow: Shadows.Components.accountCardWidget
	},
	art: {
		position: 'absolute',
		height: ART_SIZE,
		width: ART_SIZE,
		right: 0,
		top: -ART_TOP_OFFSET,
		resizeMode: 'stretch',
		opacity: ART_OPACITY
	},
	actionBar: {
		flexDirection: 'row',
		backgroundColor: BUTTON_BACKGROUND_COLOR,
		borderBottomLeftRadius: BORDER_RADIUS,
		borderBottomRightRadius: BORDER_RADIUS,
		overflow: 'hidden'
	},
	actionButton: {
		height: Sizes.Semantic.controlHeight.m,
		flex: 1,
		borderRightColor: BUTTON_SEPARATOR_COLOR,
		borderRightWidth: Sizes.Semantic.borderWidth.s
	},
	actionButtonLast: {
		borderRightWidth: 0
	},
	actionButton__disabled: {
		backgroundColor: BUTTON_BACKGROUND_COLOR_DISABLED
	},
	actionButtonPressable: {
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center',
		flexDirection: 'row',
		gap: Sizes.Semantic.spacing.s
	},
	actionButtonPressable__disabled: {
		opacity: 0.5
	},
	actionButtonText: {
		...Typography.Semantic.button.m,
		color: BUTTON_TEXT_COLOR
	}
});
