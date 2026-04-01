import { TouchableNative } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

const MIN_CARD_HEIGHT = Sizes.Semantic.spacing.m * 9;

/**
 * ListItemContainer component. A pressable card container for list items
 * with optional border highlighting. Provides visual feedback on press.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render inside the container.
 * @param {string} [props.borderColor] - Optional border color. When provided, displays a colored border.
 * @param {boolean} [props.isDisabled=false] - Whether the container is disabled and non-interactive.
 * @param {object} [props.style] - Additional styles for the outer wrapper.
 * @param {object} [props.cardStyle] - Additional styles for card content container.
 * @param {object} [props.contentContainerStyle] - Additional styles for the inner card container.
 * @param {string} [props.accessibilityLabel] - Accessibility label for the touchable element.
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
	accessibilityLabel,
	onPress
}) => {
	// Computed styles
	const dynamicBorderStyle = borderColor ? { borderColor, borderWidth: Sizes.Semantic.borderWidth.m } : null;
	const cardStyles = [styles.card, dynamicBorderStyle, contentContainerStyle, cardStyle];
	const rootStyles = [styles.root, style];

	// Handlers
	const handlePress = useCallback(() => {
		if (isDisabled || !onPress)
			return;

		onPress();
	}, [isDisabled, onPress]);


	return (
		<View style={rootStyles}>
			<TouchableNative
				onPress={handlePress}
				disabled={isDisabled}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel}
			>
				<View style={cardStyles}>
					{children}
				</View>
			</TouchableNative>
		</View>
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
