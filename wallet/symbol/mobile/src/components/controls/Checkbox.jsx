import { useColorTransition } from '@/app/hooks';
import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

/**
 * A checkbox component that allows users to select or deselect an option, with animated interactions and support for disabled state.
 *
 * @param {object} props - Component props.
 * @param {string} props.text - Label text.
 * @param {boolean} props.value - Current checked state.
 * @param {function} props.onChange - Called with the next checked state.
 * @param {boolean} [props.isDisabled=false] - Disable checkbox if true.
 * @param {object} [props.style] - Optional container style overrides.
 */
export const Checkbox = ({ style, text, value, onChange, isDisabled = false }) => {
	// Color and style animations
	const palette = Colors.Components.control.default;

	const {
		transition,
		animateIn,
		animateOut,
		createAnimatedStyles
	} = useColorTransition({
		palette,
		isDisabled,
		transitionState: 'focused'
	});
	const animatedContainer = createAnimatedStyles([
		{ property: 'background', styleProperty: 'backgroundColor' },
		{ property: 'border', styleProperty: 'borderColor' }
	]);
	const animatedText = createAnimatedStyles([
		{ property: 'text', styleProperty: 'color' }
	]);
	const animatedCheck = useAnimatedStyle(() => ({
		transform: [{ scale: interpolate(transition.value, [0, 1], [1, 0]) }]
	}));
	const checkStyles = [styles.icon, animatedCheck, !value ? styles.hidden : null];

	// Handlers
	const handlePress = e => {
		e?.stopPropagation?.();
		if (isDisabled) 
			return;
		onChange?.(!value);
	};

	return (
		<Pressable
			style={[styles.root, style]}
			hitSlop={5}
			onPress={handlePress}
			onPressIn={animateIn}
			onPressOut={animateOut}
			disabled={isDisabled}
		>
			<Animated.View style={[styles.container, animatedContainer]}>
				<Animated.Image source={require('@/app/assets/images/components/checkbox.png')} style={checkStyles} />
			</Animated.View>
			<Animated.Text style={[styles.text, animatedText]}>
				{text}
			</Animated.Text>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	root: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center'
	},
	container: {
		width: 22,
		height: 22,
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: Sizes.Semantic.borderRadius.s,
		borderWidth: Sizes.Semantic.borderWidth.s,
		borderStyle: 'solid',
		marginRight: Sizes.Semantic.spacing.m
	},
	icon: {
		width: 18,
		height: 18
	},
	hidden: {
		opacity: 0
	},
	text: {
		...Typography.Semantic.label.m
	}
});
