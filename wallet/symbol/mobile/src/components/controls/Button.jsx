import { useColorTransition } from '@/app/hooks';
import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

/** @typedef {import('@/app/types/ColorVariants').ButtonColorVariants} ButtonColorVariants */

/**
 * Button component. A customizable button that supports different visual types and color variants,
 * featuring animated press interactions for enhanced user feedback.
 * @param {object} props - Component props.
 * @param {string} props.text - Button text.
 * @param {boolean} [props.isDisabled=false] - Disable button if true.
 * @param {'bordered'|'solid'} [type='bordered'] - Button appearance type (bordered or solid).
 * @param {ButtonColorVariants} [props.variant='secondary'] - Button color variant.
 * @param {object} [props.style] - Additional styles for the button container.
 * @param {function(): void} props.onPress - Function to call on button press.
 * @returns {React.ReactNode} Button component.
 */
export const Button = ({ text, isDisabled = false, type = 'bordered', variant = 'secondary', style, onPress }) => {
	// Color and style animations
	const palette =
		type === 'solid'
			? Colors.Components.buttonSolid?.[variant]
			: Colors.Components.buttonBordered?.[variant];

	const {
		animateIn,
		animateOut,
		createAnimatedStyles
	} = useColorTransition({
		palette,
		isDisabled,
		transitionState: 'pressed'
	});
	const animatedContainer = createAnimatedStyles([
		{ property: 'background', styleProperty: 'backgroundColor' },
		{ property: 'border', styleProperty: 'borderColor' }
	]);
	const animatedText = createAnimatedStyles([
		{ property: 'text', styleProperty: 'color' }
	]);

	// Handlers
	const handlePress = e => {
		e?.stopPropagation?.();
		if (isDisabled) 
			return;
		onPress?.();
	};

	return (
		<Pressable onPress={handlePress} onPressIn={animateIn} onPressOut={animateOut} disabled={isDisabled}>
			<Animated.View style={[styles.root, animatedContainer, style]}>
				<Animated.Text style={[styles.text, animatedText]}>
					{text}
				</Animated.Text>
			</Animated.View>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	root: {
		width: '100%',
		height: Sizes.Semantic.controlHeight.m,
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: Sizes.Semantic.borderRadius.s,
		borderWidth: Sizes.Semantic.borderWidth.m,
		borderStyle: 'solid'
	},
	text: {
		...Typography.Semantic.button.m
	}
});
