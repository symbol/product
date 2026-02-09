import { PASSCODE_PIN_LENGTH } from '@/app/constants';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

const DOT_ANIMATION_DURATION = 250;
const DOT_MIN_SIZE = Sizes.Semantic.spacing.s;
const DOT_MAX_SIZE = Sizes.Semantic.spacing.l;
const DOT_COLOR_DEFAULT = Colors.Semantic.role.secondary.default;
const DOT_COLOR_ERROR = Colors.Semantic.role.danger.default;

/**
 * Dot component. A single dot indicator for passcode entry.
 */
const Dot = ({ isFilled, isError }) => {
	const animatedStyle = useAnimatedStyle(() => {
		const size = isFilled ? DOT_MAX_SIZE : DOT_MIN_SIZE;
		const backgroundColor = isError ? DOT_COLOR_ERROR : DOT_COLOR_DEFAULT;
		
		return {
			width: withTiming(size, { duration: DOT_ANIMATION_DURATION }),
			height: withTiming(size, { duration: DOT_ANIMATION_DURATION }),
			backgroundColor
		};
	});

	return (
		<Animated.View style={[styles.dot, animatedStyle]} />
	);
};

/**
 * Dots component. A row of dots showing passcode entry progress with shake animation support.
 *
 * @param {object} props - Component props.
 * @param {number} [props.length=PASSCODE_PIN_LENGTH] - Total number of dots.
 * @param {number} props.filledCount - Number of filled dots.
 * @param {boolean} [props.isError=false] - Whether to show error state.
 * @param {object} props.shakeAnimation - Shared value for shake animation.
 * 
 * @returns {React.ReactNode} The dots component.
 */
export const Dots = ({ length = PASSCODE_PIN_LENGTH, filledCount, isError = false, shakeAnimation }) => {
	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: shakeAnimation.value }]
	}));

	return (
		<Animated.View style={[styles.container, animatedStyle]}>
			{Array.from({ length }).map((_, index) => (
				<Dot 
					key={index} 
					isFilled={index < filledCount} 
					isError={isError}
				/>
			))}
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.l,
		height: DOT_MAX_SIZE
	},
	dot: {
		borderRadius: Sizes.Semantic.borderRadius.round
	}
});
