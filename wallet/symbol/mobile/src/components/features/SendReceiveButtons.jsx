import { 
	CopyButtonContainer, 
	DialogBox, 
	Field, 
	FlexContainer, 
	Icon, 
	QrCodeView, 
	Stack, 
	StyledText, 
	TouchableNative 
} from '@/app/components';
import { useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const BUTTON_HEIGHT = Sizes.Semantic.controlHeight.m;
const BUTTON_BACKGROUND_COLOR = Colors.Components.buttonSendReceive.primary.default.background;
const BUTTON_BACKGROUND_COLOR_DISABLED = Colors.Components.buttonSendReceive.primary.disabled.background;
const BUTTON_SEPARATOR_COLOR = Colors.Components.buttonSendReceive.primary.default.separator;
const BUTTON_SEPARATOR_COLOR_DISABLED = Colors.Components.buttonSendReceive.primary.disabled.separator;
const BUTTON_TEXT_COLOR = Colors.Components.buttonSendReceive.primary.default.text;

/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * ActionButton component.
 *
 * Internal button component for SendReceiveButtons action bar.
 * @param {object} props - Component props.
 * @param {string} props.icon - Icon name to display.
 * @param {string} props.text - Button label text.
 * @param {boolean} [props.isLast=false] - Whether this is the last button (no right border).
 * @param {boolean} [props.isDisabled=false] - Whether this button is disabled.
 * @param {function(): void} props.onPress - Callback when button is pressed.
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
				<Icon name={icon} size="xs" />
				<Text style={styles.actionButtonText}>{text}</Text>
			</TouchableNative>
		</View>
	);
};

/**
 * SendReceiveButtons component. A pair of action buttons for receiving and sending transactions,
 * styled to match AccountCardWidget action bar. The receive button displays a QR code dialog,
 * while the send button either triggers the send callback or shows a multisig warning dialog.
 * @param {object} props - Component props.
 * @param {ChainName} props.chainName - The name of the blockchain network.
 * @param {string} props.accountAddress - The account address to receive transactions.
 * @param {string} [props.tokenName] - The name of the token.
 * @param {string} props.receiveQrData - QR code data string of the account address.
 * @param {function(): void} props.onSendPress - Callback fired when send button is pressed (if not multisig).
 * @param {boolean} [props.hasMultisigSendWarning=false] - If true, shows multisig warning instead of triggering send.
 * @param {boolean} [props.isDisabled=false] - Disables both buttons if true.
 * @returns {React.ReactNode} SendReceiveButtons component.
 */
export const SendReceiveButtons = ({ 
	chainName, 
	accountAddress, 
	tokenName, 
	receiveQrData, 
	onSendPress, 
	hasMultisigSendWarning = false,
	isDisabled = false
}) => {
	// State
	const [isReceiveDialogShown, toggleReceiveDialog] = useToggle(false);
	const [isMultisigWarningShown, toggleMultisigWarning] = useToggle(false);

	const isTokenVisible = Boolean(tokenName);

	// Handlers
	const handleSendPress = () => {
		if (hasMultisigSendWarning)
			toggleMultisigWarning();
		else
			onSendPress?.();
	};

	return (
		<View style={styles.root}>
			<ActionButton
				icon="receive"
				text={$t('button_receive')}
				isDisabled={isDisabled}
				onPress={toggleReceiveDialog}
			/>
			<ActionButton
				icon="send-plane"
				text={$t('button_send')}
				isLast
				isDisabled={isDisabled}
				onPress={handleSendPress}
			/>
			<DialogBox
				type="alert"
				title={$t('button_receive')}
				isVisible={isReceiveDialogShown}
				onSuccess={toggleReceiveDialog}
			>
				<Stack>
					<FlexContainer center>
						<QrCodeView qrDataString={receiveQrData} />
					</FlexContainer>
					{isTokenVisible && (
						<Field title={$t('fieldTitle_token')}>
							<StyledText>
								{tokenName}
							</StyledText>
						</Field>
					)}
					<Field title={$t('fieldTitle_chainName')}>
						<StyledText>
							{chainName}
						</StyledText>
					</Field>
					<Field title={$t('fieldTitle_recipientAddress')}>
						<CopyButtonContainer value={accountAddress}>
							<StyledText>
								{accountAddress}
							</StyledText>
						</CopyButtonContainer>
					</Field>
				</Stack>
			</DialogBox>
			<DialogBox
				type="alert"
				title={$t('warning_multisig_title')}
				text={$t('warning_multisig_body')}
				isVisible={isMultisigWarningShown}
				onSuccess={toggleMultisigWarning}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		borderRadius: Sizes.Semantic.borderRadius.m,
		overflow: 'hidden'
	},
	actionButton: {
		backgroundColor: BUTTON_BACKGROUND_COLOR,
		height: BUTTON_HEIGHT,
		flex: 1,
		borderRightColor: BUTTON_SEPARATOR_COLOR,
		borderRightWidth: Sizes.Semantic.borderWidth.s
	},
	actionButtonLast: {
		borderRightWidth: 0
	},
	actionButton__disabled: {
		backgroundColor: BUTTON_BACKGROUND_COLOR_DISABLED,
		borderRightColor: BUTTON_SEPARATOR_COLOR_DISABLED
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
		fontSize: Typography.Semantic.button.m.fontSize * 0.9,
		color: BUTTON_TEXT_COLOR
	}
});
