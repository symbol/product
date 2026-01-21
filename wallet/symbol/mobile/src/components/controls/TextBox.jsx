import { useDualColorTransition } from '@/app/hooks';
import { Colors, Sizes, Typography } from '@/app/styles';
import React, { createRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const MULTILINE_NUMBER_OF_LINES = 7;

/**
 * TextBox component. A text input field with support for labels, error messages, multiline input, and animated focus interactions.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} [props.contentRight] - Content to display on the right side of the input.
 * @param {string} [props.errorMessage] - Error message to display below the input. If provided, the input will turn to error state.
 * @param {React.Ref} [props.innerRef] - Ref for the TextInput component.
 * @param {boolean} [props.isDisabled=false] - Whether the input is disabled.
 * @param {string} [props.keyboardType] - Keyboard type for the input.
 * @param {boolean} [props.multiline=false] - Whether the input is multiline.
 * @param {string} [props.placeholder] - Placeholder for the input.
 * @param {object} [props.style] - Additional styles for the component container.
 * @param {string} [props.label] - Title label displayed above the input.
 * @param {string} [props.value] - Current value of the input.
 * @param {function} [props.onChange] - Function to call when the input value changes.
 * 
 * @returns {React.ReactNode} TextBox component
 */
export const TextBox = props => {
	const {
		contentRight,
		errorMessage,
		innerRef,
		isDisabled = false,
		keyboardType,
		multiline,
		placeholder,
		style,
		label,
		value,
		onChange
	} = props;
	const ref = innerRef || createRef();
	const isError = Boolean(errorMessage);
	const numberOfLines = multiline ? MULTILINE_NUMBER_OF_LINES : 1;

	// Colors and style animations
	const primaryPalette = Colors.Components.control.default;
	const secondaryPalette = Colors.Components.control.danger;
	
	const {
		animateIn,
		animateOut,
		createAnimatedStyles
	} = useDualColorTransition({
		primaryPalette,
		secondaryPalette,
		transitionState: 'focused',
		isDisabled,
		isSecondaryActive: isError
	});
	const animatedContainer = createAnimatedStyles([
		{ property: 'background', styleProperty: 'backgroundColor' },
		{ property: 'border', styleProperty: 'borderColor' }
	]);
	const animatedLabel = createAnimatedStyles([
		{ property: 'label', styleProperty: 'color' }
	]);
	const animatedText = createAnimatedStyles([
		{ property: 'text', styleProperty: 'color' }
	]);
	const styleInput = [styles.input, multiline && styles.inputMultiline];

	// Handlers
	const handleWrapperPress = e => {
		e?.stopPropagation?.();
		if (isDisabled) 
			return;
		ref?.current?.focus();
	};

	return (
		<Pressable onPress={handleWrapperPress}>
			<Animated.View style={[styles.root, animatedContainer, style]}>
				<View style={styles.inputContainer}>
					<Animated.Text style={[styles.label, animatedLabel]}>
						{label}
					</Animated.Text>
					<Animated.View style={animatedText}>
						<TextInput
							editable={!isDisabled}
							multiline={multiline}
							numberOfLines={numberOfLines}
							keyboardType={keyboardType}
							accessibilityLabel={label}
							accessibilityValue={`${value}`}
							placeholder={placeholder}
							placeholderTextColor={Colors.Components.control.default.default.placeholder}
							style={styleInput}
							value={`${value}`}
							ref={ref}
							onFocus={animateIn}
							onBlur={animateOut}
							onChangeText={onChange}
						/>
					</Animated.View>
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
		</Pressable>
	);
};

const CONTAINER_BORDER_WIDTH = Sizes.Semantic.borderWidth.m;
const EXTRA_PIXEL_OFFSET = 0.75;

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		width: '100%',
		minHeight: Sizes.Semantic.controlHeight.m,
		paddingRight: Sizes.Semantic.spacing.m,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		borderRadius: Sizes.Semantic.borderRadius.s,
		borderWidth: CONTAINER_BORDER_WIDTH,
		borderStyle: 'solid'
	},
	inputContainer: {
		alignSelf: 'stretch',
		flex: 1,
		flexDirection: 'column',
		paddingRight: Sizes.Semantic.spacing.m,
		paddingLeft: Sizes.Semantic.spacing.m - EXTRA_PIXEL_OFFSET
	},
	label: {
		...Typography.Semantic.label.s,
		transform: [{ translateY: (Typography.Semantic.label.s.lineHeight / 4) - (CONTAINER_BORDER_WIDTH / 2) }],
		paddingLeft: EXTRA_PIXEL_OFFSET
	},
	input: {
		...Typography.Semantic.input.m,
		color: Colors.Components.control.default.default.text,
		height: Typography.Semantic.input.m.lineHeight,
		padding: 0
	},
	inputMultiline: {
		textAlignVertical: 'top',
		marginBottom: Sizes.Semantic.spacing.m,
		height: undefined,
		minHeight: (Typography.Semantic.input.m.lineHeight * (MULTILINE_NUMBER_OF_LINES + 1)) - (CONTAINER_BORDER_WIDTH * 2)
	},
	errorContainer: {
		backgroundColor: 'transparent',
		position: 'absolute',
		bottom: -Typography.Semantic.body.m.lineHeight - Sizes.Semantic.spacing.xs
	},
	errorText: {
		...Typography.Semantic.body.m,
		color: Colors.Semantic.role.danger.default
	}
});
