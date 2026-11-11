import { Icon, StyledText } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const DEFAULT_VARIANT = 'neutral';

const variantIconMap = {
	neutral: 'info-circle',
	info: 'info-circle',
	success: 'check-circle',
	warning: 'alert-warning',
	danger: 'alert-danger'
};

/**
 * Alert component. A component for displaying status messages with optional icons and titles,
 * supporting various visual variants for different message types.
 * @param {object} props - Component props.
 * @param {import('@/app/types/ColorVariants').SemanticRoleColorVariants} [props.variant='neutral'] - Alert variant
 * determining the color scheme and icon.
 * @param {string} [props.icon] - Optional icon name to override the default icon for the variant.
 * @param {string} [props.title] - Optional title text displayed prominently above the body text.
 * @param {string} props.body - Main message content to display in the alert.
 * @param {boolean} [props.isIconHidden=false] - Whether to hide the icon.
 * @param {object} [props.style] - Additional styles for the alert container.
 * @returns {React.ReactNode} Alert component.
 */
export const Alert = ({ variant = DEFAULT_VARIANT, icon, title, body, isIconHidden = false, style }) => {
	const palette = Colors.Components.alert[variant];
	const iconName = icon ?? variantIconMap[variant];
	const containerStyle = { backgroundColor: palette.background };
	const textStyle = { color: palette.text };

	return (
		<View style={[styles.root, containerStyle, style]}>
			{!isIconHidden && iconName && (
				<Icon name={iconName} variant={variant} size="m" color={palette.text} />
			)}
			{!!title && (
				<StyledText type="label" size="l" style={[styles.text, textStyle]}>
					{title}
				</StyledText>
			)}
			<StyledText type="body" style={[styles.text, textStyle]}>
				{body}
			</StyledText>
		</View>
	);
};


const styles = StyleSheet.create({
	root: {
		flexDirection: 'column',
		padding: Sizes.Semantic.layoutSpacing.s,
		borderRadius: Sizes.Semantic.borderRadius.m,
		alignItems: 'center',
		gap: Sizes.Semantic.layoutSpacing.xs
	},
	text: {
		textAlign: 'center'
	}
});
