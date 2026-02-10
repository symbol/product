import { TouchableNative } from '@/app/components';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { Colors, Sizes } from '@/app/styles';
import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const SCALE_DEFAULT = 1;
const SCALE_EXPANDED = 1.2;
const ANIMATION_DURATION_MS = 250;
const MIN_CARD_HEIGHT = 75;

/**
 * ListItemContainer component. A pressable card container for list items with animated
 * scale transitions and optional border highlighting. Provides visual feedback on press
 * and collapses when navigating back to the list screen.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render inside the container.
 * @param {string} [props.borderColor] - Optional border color. When provided, displays a colored border.
 * @param {boolean} [props.isDisabled=false] - Whether the container is disabled and non-interactive.
 * @param {object} [props.style] - Additional styles for the outer wrapper.
 * @param {object} [props.cardStyle] - Additional styles for card content container.
 * @param {object} [props.contentContainerStyle] - Additional styles for the inner card container.
 * @param {function} [props.onPress] - Function to call when the container is pressed.
 *
 * @returns {React.ReactNode} ListItemContainer component
 */
export const ListItemContainer = ({
	children,
	borderColor,
	isDisabled = false,
	style,
	cardStyle,
	contentContainerStyle,
	onPress
}) => {
	// State
	const [isExpanded, setIsExpanded] = useState(false);
	const isFocused = useIsFocused();

	// Animation values
	const scale = useSharedValue(SCALE_DEFAULT);

	// Animated styles
	const animatedCardStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }]
	}));

	// Computed styles
	const dynamicBorderStyle = borderColor ? { borderColor, borderWidth: Sizes.Semantic.borderWidth.m } : null;
	const cardStyles = [styles.card, dynamicBorderStyle, animatedCardStyle, contentContainerStyle, cardStyle];
	const rootStyles = [styles.root, style];

	// Handlers
	const handlePress = useCallback(() => {
		if (isDisabled || !onPress) 
			return;

		onPress();
		setIsExpanded(true);
	}, [isDisabled, onPress]);

	// Effects
	useEffect(() => {
		const shouldCollapse = isFocused && isExpanded;

		if (!shouldCollapse) 
			return;

		if (PlatformUtils.getOS() === 'android') 
			scale.value = SCALE_EXPANDED;

		scale.value = withTiming(SCALE_DEFAULT, { duration: ANIMATION_DURATION_MS });
		setIsExpanded(false);
	}, [isFocused, isExpanded, scale]);

	return (
		<Animated.View entering={FadeIn} style={rootStyles}>
			<TouchableNative onPress={handlePress} disabled={isDisabled}>
				<Animated.View style={cardStyles}>
					{children}
				</Animated.View>
			</TouchableNative>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative'
	},
	card: {
		width: '100%',
		minHeight: MIN_CARD_HEIGHT,
		backgroundColor: Colors.Components.card.background,
		borderRadius: Sizes.Semantic.borderRadius.s,
		paddingHorizontal: Sizes.Semantic.layoutPadding.m,
		paddingVertical: Sizes.Semantic.layoutPadding.s
	}
});
