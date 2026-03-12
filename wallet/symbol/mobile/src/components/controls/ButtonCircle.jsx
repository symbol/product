import { Icon, TouchableNative } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet } from 'react-native';

const BUTTON_SIZE = Sizes.Component.circleButton.m.surface.size;
const ICON_SIZE = 's';
const ELEVATION = 2;

/**
 * Available button color variants.
 * @readonly
 * @enum {string}
 */
const ButtonVariant = {
	SECONDARY: 'secondary',
	DANGER: 'danger',
	WARNING: 'warning',
	NEUTRAL: 'neutral'
};

/**
 * ButtonCircle component. A circular floating action button with icon support,
 * featuring animated press interactions and multiple color variants.
 *
 * @param {object} props - Component props
 * @param {string} props.icon - Icon name to display inside the button.
 * @param {'secondary'|'danger'|'warning'|'neutral'} [props.variant='secondary'] - Button color variant.
 * @param {boolean} [props.isDisabled=false] - Disables the button if true.
 * @param {boolean} [props.isFloating=true] - If true, applies absolute positioning.
 * @param {function} props.onPress - Callback fired on button press.
 *
 * @returns {React.ReactNode} Circle button component
 */
export const ButtonCircle = ({
	icon,
	variant = ButtonVariant.SECONDARY,
	isDisabled = false,
	isFloating = true,
	onPress
}) => {
	const styleMap = {
		[ButtonVariant.SECONDARY]: styles.surface_secondary,
		[ButtonVariant.DANGER]: styles.surface_danger,
		[ButtonVariant.WARNING]: styles.surface_warning,
		[ButtonVariant.NEUTRAL]: styles.surface_neutral
	};
	const surfaceStyle = styleMap[variant];
	const floatingStyle = isFloating ? styles.root_floating : null;

	const handlePress = e => {
		e?.stopPropagation?.();

		if (isDisabled)
			return;

		onPress?.();
	};

	return (
		<TouchableNative
			containerStyle={[styles.root, floatingStyle]}
			style={[styles.surface, surfaceStyle]}
			accessibilityRole="button"
			accessibilityLabel={icon}
			disabled={isDisabled}
			onPress={handlePress}
		>
			<Icon name={icon} size={ICON_SIZE} variant="inverse" />
		</TouchableNative>
	);
};

const styles = StyleSheet.create({
	root: {
		width: BUTTON_SIZE,
		height: BUTTON_SIZE,
		borderRadius: Sizes.Semantic.borderRadius.round,
		overflow: 'hidden',
		elevation: ELEVATION
	},
	root_floating: {
		position: 'absolute',
		bottom: Sizes.Semantic.layoutPadding.m,
		right: Sizes.Semantic.layoutPadding.m
	},
	surface: {
		width: BUTTON_SIZE,
		height: BUTTON_SIZE,
		justifyContent: 'center',
		alignItems: 'center'
	},
	surface_secondary: {
		backgroundColor: Colors.Components.buttonSolid.secondary.default.background
	},
	surface_danger: {
		backgroundColor: Colors.Components.buttonSolid.danger.default.background
	},
	surface_warning: {
		backgroundColor: Colors.Components.buttonSolid.warning.default.background
	},
	surface_neutral: {
		backgroundColor: Colors.Components.buttonSolid.neutral.default.background
	}
});
