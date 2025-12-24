import { ButtonCopy, DialogBox, TouchableNative } from '@/app/components';
import { useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { borders, colors, fonts, layout, spacings } from '@/app/styles';
import { validateAccountName, validateRequired } from '@/app/utils';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const KNOWN_ACCOUNT_APPEARANCES = {
    'ethereum': {
		backgroundImageSrc: require('@/app/assets/images/account-backgrounds/ethereum.png'),
		buttonBackgroundColor: '#8A92B2',
		buttonTouchableColor: '#8A92B2',
		buttonTextColor: '#0B0118',
	},
};

export const AccountCardWidget = props => {
	const {
		chainName,
		address,
		onSwapPress,
		onSendPress,
	} = props;
	const [isNameEditShown, toggleNameEdit] = useToggle(false);
	const nameValidators = [validateRequired(), validateAccountName()];
	const appearance = KNOWN_ACCOUNT_APPEARANCES[chainName.toLowerCase()] || {};
	const controlsColorStyle = { backgroundColor: appearance.buttonBackgroundColor };

	const handleNameChange = newName => {
		toggleNameEdit();
		onNameChange(newName);
	};

	return (
		<View style={styles.root}>
			<Image source={appearance.backgroundImageSrc} style={styles.background} />
			<View style={styles.content}>	
				<View>
					<Text style={styles.textTitle}>{$t('c_accountCard_title_account')}</Text>
					<Text style={styles.textName}>{chainName}</Text>
				</View>
				<View>
					<Text style={styles.textTitle}>{$t('c_accountCard_title_address')}</Text>
					<View style={layout.row}>
						<Text style={styles.textAddress}>{address}</Text>
						<ButtonCopy content={address} />
					</View>
				</View>
			</View>
			<View style={[styles.controls, controlsColorStyle]}>
				<View style={styles.button}>
					<TouchableNative color={appearance.buttonBackgroundColor} onPress={onSendPress} style={styles.buttonPressable}>
						<Text style={styles.textButton}>{$t('c_accountCard_button_send')}</Text>
					</TouchableNative>
				</View>
				<View style={[styles.button, styles.clearBorderRight]}>
					<TouchableNative color={appearance.buttonTouchableColor} onPress={onSwapPress} style={styles.buttonPressable}>
						<Text style={styles.textButton}>SWAP</Text>
					</TouchableNative>
				</View>
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
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		width: '100%',
		backgroundColor: colors.bgCard,
		borderRadius: borders.borderRadiusForm,
		overflow: 'hidden',
	},
	background: {
		position: 'absolute',
		height: '100%',
		width: '100%',
		left: 0,
		top: 0,
	},
	content: {
		position: 'relative',
		width: '100%',
		gap: spacings.margin,
		paddingHorizontal: spacings.padding,
		paddingVertical: spacings.padding
	},
	textTitle: {
		...fonts.label,
		opacity: 0.7,
		color: colors.textForm
	},
	textName: {
		...fonts.title,
		color: colors.textForm
	},
	textAddress: {
		...fonts.body,
		color: colors.textForm,
		marginRight: spacings.margin / 2
	},
	controls: {
		flexDirection: 'row',
		borderBottomLeftRadius: borders.borderRadiusForm,
		borderBottomRightRadius: borders.borderRadiusForm,
		overflow: 'hidden'
	},
	button: {
		height: 48,
		flex: 1,
		borderRightColor: colors.bgCard,
		borderRightWidth: 1
	},
	buttonPressable: {
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center',
		flexDirection: 'row'
	},
	icon: {
		width: 18,
		height: 18,
		marginRight: spacings.paddingSm / 2
	},
	textButton: {
		...fonts.button,
		fontSize: 15,
		color: '#0B0118'
	},
	clearBorderRight: {
		borderRightWidth: null
	}
});
