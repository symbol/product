import { Stack, StyledText, TextBox } from '@/app/components';
import { useValidation } from '@/app/hooks';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Dialog box types configuration
 * Maps dialog type to its button configuration
 */
const DIALOG_TYPE_CONFIG = {
	prompt: (onSuccess, onCancel, isPromptValueValid, promptValue) => [
		{
			type: 'ok',
			handler: () => isPromptValueValid && onSuccess(promptValue),
			variant: 'primary'
		},
		{
			type: 'cancel',
			handler: onCancel,
			variant: 'secondary'
		}
	],
	accept: onSuccess => [
		{
			type: 'accept',
			handler: onSuccess,
			variant: 'primary'
		}
	],
	confirm: (onSuccess, onCancel) => [
		{
			type: 'confirm',
			handler: onSuccess,
			variant: 'primary'
		},
		{
			type: 'cancel',
			handler: onCancel,
			variant: 'secondary'
		}
	],
	alert: onSuccess => [
		{
			type: 'ok',
			handler: onSuccess,
			variant: 'primary'
		}
	]
};

/**
 * DialogButton component
 *
 * Internal button component for DialogBox.
 *
 * @param {object} props - Component props
 * @param {string} props.type - Button type. Determines the display text.
 * @param {'primary'|'secondary'} props.variant='primary' - Button style variant.
 * @param {boolean} props.isDisabled=false - Disables the button if true.
 * @param {function} props.onPress - Callback when button is pressed.
 */
const DialogButton = ({ type, variant, isDisabled = false, onPress }) => {
	const variantStyleMap = {
		primary: !isDisabled ? styles.buttonPrimary : styles.buttonPrimary__disabled,
		secondary: !isDisabled ? styles.buttonSecondary : styles.buttonSecondary__disabled
	};
	const typeTextMap = {
		ok: $t('button_ok'),
		accept: $t('button_accept'),
		confirm: $t('button_confirm'),
		cancel: $t('button_cancel')
	};
	const buttonStyle = variantStyleMap[variant];
	const text = typeTextMap[type];

	return (
		<View style={styles.buttonWrapper}>
			<TouchableOpacity onPress={onPress} style={[styles.button, buttonStyle]} disabled={isDisabled}>
				<Text style={buttonStyle}>{text}</Text>
			</TouchableOpacity>
		</View>
	);
};

/**
 * DialogBox component. A modal dialog component supporting various interaction types including
 * alerts, confirmations, acceptances, and prompts with optional input validation.
 *
 * @param {object} props - Component props
 * @param {boolean} props.isVisible - Controls the visibility of the dialog.
 * @param {boolean} [props.isDisabled=false] - Disables all buttons if true.
 * @param {'alert'|'confirm'|'accept'|'prompt'} [props.type='alert'] - Dialog type determining button configuration.
 * @param {string} props.title - Dialog title text.
 * @param {string} [props.text] - Dialog body text or prompt label.
 * @param {React.ReactNode} [props.children] - Additional children elements.
 * @param {Array} [props.promptValidators] - Validation rules for prompt input.
 * @param {function} props.onSuccess - Callback when primary action is triggered.
 * @param {function} [props.onCancel] - Callback when cancel action is triggered.
 * @param {object} [props.style] - Additional styles for the modal container.
 * @param {object} [props.contentContainerStyle] - Additional styles for the content area.
 *
 * @returns {React.ReactNode} DialogBox component
 */
export const DialogBox = props => {
	const {
		isVisible,
		isDisabled = false,
		type = 'alert',
		title,
		text,
		children,
		promptValidators = [],
		onSuccess,
		onCancel,
		style,
		contentContainerStyle
	} = props;

	// State
	const [promptValue, setPromptValue] = useState('');

	// Validation
	const promptErrorMessage = useValidation(promptValue, promptValidators, $t);
	const isPromptValueValid = !promptErrorMessage;

	const isPrompt = type === 'prompt';
	const configFn = DIALOG_TYPE_CONFIG[type];
	const buttons = configFn(onSuccess, onCancel, isPromptValueValid, promptValue);

	// Reset prompt value when dialog visibility changes
	useEffect(() => {
		setPromptValue('');
	}, [isVisible]);

	if (!isVisible)
		return null;

	// Temporary workaround for broken Modal in react-native v82 on iOS
	const animationType = PlatformUtils.getOS() === 'ios' ? undefined : 'fade';

	return (
		<Modal
			animationType={animationType}
			transparent
			visible={isVisible}
			onRequestClose={onCancel}
		>
			<View style={styles.overlay}>
				<SafeAreaView style={styles.safeArea}>
					<View style={[styles.modal, style]}>
						<View style={[styles.content, contentContainerStyle]}>
							<Stack>
								<StyledText type="title">
									{title}
								</StyledText>
								{!!text && !isPrompt && (
									<StyledText type="body">
										{text}
									</StyledText>
								)}
								<ScrollView>
									{children}
								</ScrollView>
							</Stack>
							{isPrompt && (
								<TextBox
									label={text}
									errorMessage={promptErrorMessage}
									value={promptValue}
									onChange={setPromptValue}
								/>
							)}
						</View>
						<View style={styles.buttonContainer}>
							{buttons.map((button, index) => (
								<DialogButton
									key={`dialog-btn-${index}`}
									isDisabled={isDisabled && button.type !== 'cancel'}
									type={button.type}
									variant={button.variant}
									onPress={button.handler}
								/>
							))}
						</View>
					</View>
				</SafeAreaView>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	overlay: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		top: 0,
		backgroundColor: Colors.Semantic.overlay.primary.default,
		padding: Sizes.Semantic.layoutPadding.m
	},
	safeArea: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	},
	modal: {
		width: '100%',
		minHeight: 150,
		maxHeight: '90%',
		flexDirection: 'column',
		justifyContent: 'space-between',
		backgroundColor: Colors.Components.dialog.background,
		borderRadius: Sizes.Semantic.borderRadius.m,
		overflow: 'hidden'
	},
	content: {
		padding: Sizes.Semantic.layoutPadding.m,
		flexShrink: 1
	},
	buttonContainer: {
		height: Sizes.Semantic.controlHeight.m,
		flexDirection: 'row',
		overflow: 'hidden'
	},
	buttonWrapper: {
		height: Sizes.Semantic.controlHeight.m,
		flexShrink: 1,
		flexGrow: 1
	},
	button: {
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center',
		flexDirection: 'row'
	},
	buttonPrimary: {
		...Typography.Semantic.button.m,
		backgroundColor: Colors.Components.buttonCardEmbedded.primary.default.background,
		color: Colors.Components.buttonCardEmbedded.primary.default.text
	},
	buttonPrimary__disabled: {
		...Typography.Semantic.button.m,
		backgroundColor: Colors.Components.buttonCardEmbedded.primary.disabled.background,
		color: Colors.Components.buttonCardEmbedded.primary.disabled.text
	},
	buttonSecondary: {
		...Typography.Semantic.button.m,
		backgroundColor: Colors.Components.buttonCardEmbedded.neutral.default.background,
		color: Colors.Components.buttonCardEmbedded.neutral.default.text
	},
	buttonSecondary__disabled: {
		...Typography.Semantic.button.m,
		backgroundColor: Colors.Components.buttonCardEmbedded.neutral.disabled.background,
		color: Colors.Components.buttonCardEmbedded.neutral.disabled.text
	}
});
