import { ButtonPlain, CopyButton } from '@/app/components';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * MnemonicView component. A display component for mnemonic phrases, featuring show/hide toggle
 * functionality and a copy button when the phrase is revealed.
 *
 * @param {object} props - Component props
 * @param {boolean} props.isShown - Whether the mnemonic is visible. - Whether the copy button is disabled.
 * @param {string} props.mnemonic - The mnemonic phrase to display.
 * @param {function} props.onShowPress - Callback when the show button is pressed.
 * 
 * @returns {React.ReactNode} MnemonicView component
 */
export const MnemonicView = ({ isShown, mnemonic, onShowPress }) => {
	const placeholder = Array(mnemonic.length).fill('*').join('');
	const mnemonicText = isShown ? mnemonic : placeholder;
	const styleMnemonicText = [styles.textMnemonic, !isShown && styles.hidden];

	return (
		<View style={styles.root}>
			<Text style={styleMnemonicText}>{mnemonicText}</Text>
			{isShown && (
				<CopyButton content={mnemonicText} style={styles.copy} />
			)}
			{!isShown && (
				<View style={styles.buttonContainer}>
					<ButtonPlain
						text={$t('button_showMnemonic')}
						isCentered
						onPress={onShowPress}
					/>
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		width: '100%',
		backgroundColor: Colors.Components.dataContainer.background,
		borderRadius: Sizes.Semantic.borderRadius.m
	},
	copy: {
		position: 'absolute',
		top: Sizes.Semantic.spacing.s,
		right: Sizes.Semantic.spacing.s
	},
	textMnemonic: {
		...Typography.Semantic.mnemonic.m,
		marginVertical: Sizes.Semantic.spacing.m,
		color: Colors.Components.control.default.default.text,
		textAlign: 'center',
		padding: Sizes.Semantic.spacing.l
	},
	buttonContainer: {
		position: 'absolute',
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center'
	},
	hidden: {
		opacity: 0.1
	}
});
