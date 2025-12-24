import { borders, colors, fonts, spacings, timings } from '@/app/styles';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MULTILINE_NUMBER_OF_LINES = 7;

export const TextBox = props => {
	const { testID, contentRight, multiline, keyboardType, nativePlaceholder, title, value, errorMessage, innerRef, onChange } = props;
	const isFocused = useSharedValue(false);
	const errorProgress = useSharedValue(errorMessage ? 1 : 0); // 0 = no error, 1 = error

	useEffect(() => {
		errorProgress.value = withTiming(errorMessage ? 1 : 0, timings.press);
	}, [errorMessage]);

	const styleInput = multiline ? [styles.input, styles.inputMultiline] : [styles.input];
	const numberOfLines = multiline ? MULTILINE_NUMBER_OF_LINES : null;

	const animatedContainer = useAnimatedStyle(() => {
		// Base focus interpolation (no error)
		const baseFocusColor = interpolateColor(
			isFocused.value,
			[0, 1],
			[colors.controlBaseStroke, colors.controlBaseFocussedStroke]
		);
		// Blend in error color when errorMessage is present
		const finalColor = interpolateColor(errorProgress.value, [0, 1], [baseFocusColor, colors.danger]);
		return { borderColor: finalColor };
	});

	const handleFocusIn = () => {
		isFocused.value = withTiming(true, timings.press);
	};
	const handleFocusOut = () => {
		isFocused.value = withTiming(false, timings.press);
	};

	return (
		<Animated.View style={[styles.root, animatedContainer]}>
			<View style={styles.inputContainer}>
				<Text style={styles.title}>{title}</Text>
				<TextInput
					testID={testID}
					multiline={multiline}
					numberOfLines={numberOfLines}
					keyboardType={keyboardType}
					nativePlaceholder={nativePlaceholder}
					style={styleInput}
					value={'' + value}
					ref={innerRef}
					onFocus={handleFocusIn}
					onBlur={handleFocusOut}
					onChangeText={onChange}
				/>
			</View>
			{contentRight}
			{!!errorMessage && (
				<View style={styles.errorContainer}>
					<Animated.View entering={FadeIn}>
						<Text style={styles.errorText}>{errorMessage}</Text>
					</Animated.View>
				</View>
			)}
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		width: '100%',
		minHeight: spacings.controlHeight,
		paddingRight: spacings.margin,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		borderRadius: borders.borderRadius,
		borderWidth: borders.borderWidth,
		borderStyle: 'solid',
		backgroundColor: colors.controlBaseBg
	},
	title: {
		...fonts.placeholder,
		color: colors.controlBasePlaceholder,
		marginTop: -fonts.placeholder.fontSize / 2
	},
	inputContainer: {
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'center',
		paddingHorizontal: spacings.margin
	},
	input: {
		...fonts.textBox,
		color: colors.controlBaseText,
		height: fonts.textBox.fontSize * 1.25,
		padding: 0
	},
	inputMultiline: {
		textAlignVertical: 'top',
		marginVertical: 0,
		height: null,
		minHeight: fonts.textBox.fontSize * (MULTILINE_NUMBER_OF_LINES + 1)
	},
	errorContainer: {
		backgroundColor: 'transparent',
		position: 'absolute',
		bottom: -fonts.body.fontSize - fonts.body.fontSize * 0.25
	},
	errorText: {
		...fonts.body,
		color: colors.danger
	}
});
