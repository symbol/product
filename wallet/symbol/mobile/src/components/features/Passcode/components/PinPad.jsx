import { Icon, TouchableNative } from '@/app/components';
import { Colors, Sizes, Typography } from '@/app/styles';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const BUTTON_SIZE = Sizes.Semantic.circleControlSize.xl;
const BUTTON_GAP = Sizes.Semantic.layoutSpacing.m;
const PIN_PAD_WIDTH = (BUTTON_SIZE * 3) + (BUTTON_GAP * 2);
const BUTTON_COLOR_DEFAULT = Colors.Components.buttonSolid.secondary.default.background;
const BUTTON_COLOR_PRESSED = Colors.Components.buttonSolid.secondary.pressed.background;
const PINPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'];

/**
 * PinPadButton component. A single button on the numeric keypad.
 */
const PinPadButton = ({ isDisabled, value, onPress }) => {
	const handlePress = useCallback(() => {
		onPress(value);
	}, [value, onPress]);

	if (value === '') 
		return <View style={styles.button} />;

	const isDelete = value === 'delete';
	const color = isDelete
		? null
		: BUTTON_COLOR_DEFAULT;
	const colorPressed = isDelete
		? null
		: BUTTON_COLOR_PRESSED;

	return (
		<TouchableNative
			accessibilityRole="button"
			accessibilityLabel={isDelete ? 'delete' : `${value}`}
			isDisabled={isDisabled}
			onPress={handlePress}
			containerStyle={styles.button}
			color={color}
			colorPressed={colorPressed}
		>
			{isDelete ? (
				<Icon name="backspace" size="l" variant="secondary" />
			) : (
				<Text style={styles.buttonText}>{value}</Text>
			)}
		</TouchableNative>
	);
};

/**
 * PinPad component. A numeric keypad for passcode entry.
 *
 * @param {object} props - Component props.
 * @param {function} props.onKeyPress - Callback when a number key is pressed.
 * @param {function} props.onDelete - Callback when delete key is pressed.
 * 
 * @returns {React.ReactNode} The pin pad component.
 */
export const PinPad = ({ isDisabled, onKeyPress, onDelete }) => {
	const handleKeyPress = useCallback(value => {
		if (isDisabled)
			return;
		if (value === 'delete')
			onDelete();
		else
			onKeyPress(value);
	}, [onKeyPress, onDelete, isDisabled]);

	return (
		<View style={styles.container}>
			{PINPAD_KEYS.map((value, index) => (
				<PinPadButton 
					key={index} 
					isDisabled={isDisabled}
					value={value} 
					onPress={handleKeyPress}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		width: PIN_PAD_WIDTH,
		gap: BUTTON_GAP
	},
	button: {
		width: BUTTON_SIZE,
		height: BUTTON_SIZE,
		borderRadius: Sizes.Semantic.borderRadius.round,
		justifyContent: 'center',
		alignItems: 'center'
	},
	buttonText: {
		...Typography.Semantic.button.m,
		color: Colors.Components.buttonSolid.secondary.default.text
	}
});
