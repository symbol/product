import { Icon } from '@/app/components';
import { useColorTransition } from '@/app/hooks';
import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

/**
 * ButtonPlain component. A simple button displaying text with an optional icon,
 * supporting content centering and animated press interactions.
 *
 * @param {object} props - Component props.
 * @param {string} props.text - Button text.
 * @param {string} [props.icon] - Icon name (rendered with size "s" and secondary variant).
 * @param {boolean} [props.isDisabled=false] - Disable button if true.
 * @param {boolean} [props.isCentered=false] - Center content horizontally.
 * @param {object} [props.style] - Additional styles for the button container.
 * @param {function} props.onPress - Callback fired on press.
 * 
 * @returns {React.ReactNode} Plain button component
 */
export const ButtonPlain = ({ text, icon, isDisabled = false, isCentered = false, style, onPress }) => {
	// Color and style animations
	const palette = Colors.Components.link.default;

	const {
		transition,
		animateIn,
		animateOut,
		createAnimatedStyles
	} = useColorTransition({
		palette,
		isDisabled,
		transitionState: 'default'
	});
	const animatedText = createAnimatedStyles([
		{ property: 'text', styleProperty: 'color' }
	]);
	const animatedContainer = useAnimatedStyle(() => ({
		opacity: isDisabled ? 0.5 : 1 - (transition.value * 0.3)
	}));

	// Handlers
	const handlePress = e => {
		e?.stopPropagation?.();
		if (isDisabled) 
			return;
		onPress?.();
	};

	return (
		<Pressable
			onPress={handlePress}
			onPressIn={animateIn}
			onPressOut={animateOut}
			disabled={isDisabled}
			hitSlop={5}
		>
			<Animated.View style={[styles.root, isCentered && styles.centered, style, animatedContainer]}>
				{icon ? <Icon name={icon} size="s" variant="secondary" style={styles.icon} /> : null}
				<Animated.Text style={[styles.text, animatedText]}>{text}</Animated.Text>
			</Animated.View>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		height: Sizes.Semantic.controlHeight.m
	},
	icon: {
		marginRight: Sizes.Semantic.spacing.s
	},
	centered: {
		justifyContent: 'center'
	},
	text: {
		...Typography.Semantic.link.m
	}
});
