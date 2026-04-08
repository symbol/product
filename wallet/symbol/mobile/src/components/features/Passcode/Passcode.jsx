import { Dots, PinPad, StatusText } from './components';
import { usePasscodeManager } from './hooks';
import { getPasscodeSubtitle, getPasscodeTitle } from './utils';
import { ButtonClose } from '@/app/components';
import { PASSCODE_PIN_LENGTH, PasscodeMode } from '@/app/constants';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';


/**
 * Passcode component. A component for creating or verifying a numeric passcode using a PIN entry
 * interface with custom styling.
 *
 * @param {object} props - The component props.
 * @param {'create' | 'verify'} [props.type] - The type of passcode operation.
 * @param {function} props.onSuccess - The success callback.
 * @param {function} [props.onCancel] - The cancel callback.
 * 
 * @returns {React.ReactNode} The passcode component.
 */
export const Passcode = props => {
	const { type = PasscodeMode.VERIFY, onSuccess, onCancel } = props;
	const mode = type;
	const {
		isLoading,
		isValidating,
		isError,
		errorMessage,
		remainingAttempts,
		currentInputValue,
		step,
		shakeAnimation,
		dotAnimations,
		inputKey,
		backspace
	} = usePasscodeManager({ mode, onSuccess });

	// Computed text
	const title = getPasscodeTitle(mode, step);
	const subtitle = getPasscodeSubtitle({ mode, step, errorMessage, remainingAttempts });

	if (isLoading)
		return <View style={styles.root} />;

	return (
		<View style={styles.root}>
			<Animated.View style={styles.content} entering={FadeIn}>
				<View style={styles.header}>
					<Text style={styles.title}>{title}</Text>
					<StatusText text={subtitle} isError={isError} />
				</View>
				<Dots
					length={PASSCODE_PIN_LENGTH}
					filledCount={currentInputValue.length}
					isError={isError}
					shakeAnimation={shakeAnimation}
					dotAnimations={dotAnimations}
				/>
				<PinPad
					onKeyPress={inputKey}
					onDelete={backspace}
					isDisabled={isError || isValidating}
				/>
			</Animated.View>
			{!!onCancel && (
				<ButtonClose
					text={$t('button_cancel')}
					style={styles.buttonCancel}
					onPress={onCancel}
				/>
			)}
		</View>
	);
};

/**
 * PasscodeView component. A full-screen modal wrapper for the Passcode component.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isVisible - Whether the modal is visible.
 * @param {'create' | 'verify'} [props.type] - The type of passcode operation.
 * @param {function} props.onSuccess - Callback fired on successful passcode entry.
 * @param {function} [props.onCancel] - Callback fired when the user cancels.
 *
 * @returns {React.ReactNode} PasscodeView component
 */
export const PasscodeView = ({ isVisible, type, onSuccess, onCancel }) => {
	if (!isVisible)
		return null;

	return (
		<Modal visible animationType="fade">
			<SafeAreaProvider>
				<SafeAreaView style={styles.safeArea}>
					<Passcode type={type} onSuccess={onSuccess} onCancel={onCancel} />
				</SafeAreaView>
			</SafeAreaProvider>
		</Modal>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: Colors.Components.passcode.background
	},
	root: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: Colors.Components.passcode.background
	},
	content: {
		flex: 1,
		width: '100%',
		justifyContent: 'space-around',
		alignItems: 'center',
		paddingVertical: Sizes.Semantic.layoutPadding.xxl
	},
	header: {
		alignItems: 'center',
		paddingHorizontal: Sizes.Semantic.layoutPadding.l
	},
	title: {
		...Typography.Semantic.title.m,
		color: Colors.Components.main.text,
		textAlign: 'center',
		marginBottom: Sizes.Semantic.spacing.m
	},
	buttonCancel: {
		position: 'absolute',
		right: Sizes.Semantic.spacing.s,
		top: Sizes.Semantic.spacing.s
	}
});
