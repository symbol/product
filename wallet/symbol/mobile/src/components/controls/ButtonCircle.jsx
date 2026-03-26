import { Icon, TouchableNative } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet } from 'react-native';

const DEFAULT_SIZE = 'l';
const BUTTON_SIZE_S = Sizes.Semantic.circleControlSize.s;
const BUTTON_SIZE_M = Sizes.Semantic.circleControlSize.m;
const BUTTON_SIZE_L = Sizes.Semantic.circleControlSize.l;
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
 * @param {'s'|'m'|'l'} [props.size='l'] - Button size variant.
 * @param {boolean} [props.isDisabled=false] - Disables the button if true.
 * @param {boolean} [props.isFloating=false] - If true, applies absolute positioning.
 * @param {function} props.onPress - Callback fired on button press.
 *
 * @returns {React.ReactNode} ButtonCircle component
 */
export const ButtonCircle = ({
	icon,
	variant = ButtonVariant.SECONDARY,
	size = DEFAULT_SIZE,
	isDisabled = false,
	isFloating = false,
	onPress
}) => {
	const rootSizeStyleMap = {
		s: styles.root_small,
		m: styles.root_medium,
		l: styles.root_large
	};
	const iconSizeMap = {
		s: 'xxs',
		m: 'xs',
		l: 's'
	};

	const rootSizeStyle = rootSizeStyleMap[size];
	const iconSize = iconSizeMap[size] ?? iconSizeMap[DEFAULT_SIZE];

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
			containerStyle={[styles.root, rootSizeStyle, floatingStyle]}
			style={[styles.surface, surfaceStyle]}
			accessibilityRole="button"
			accessibilityLabel={icon}
			disabled={isDisabled}
			onPress={handlePress}
		>
			<Icon name={icon} size={iconSize} variant="inverse" />
		</TouchableNative>
	);
};

const styles = StyleSheet.create({
	root: {
		overflow: 'hidden',
		elevation: ELEVATION
	},
	root_small: {
		width: BUTTON_SIZE_S,
		height: BUTTON_SIZE_S,
		borderRadius: BUTTON_SIZE_S / 2
	},
	root_medium: {
		width: BUTTON_SIZE_M,
		height: BUTTON_SIZE_M,
		borderRadius: BUTTON_SIZE_M / 2
	},
	root_large: {
		width: BUTTON_SIZE_L,
		height: BUTTON_SIZE_L,
		borderRadius: BUTTON_SIZE_L / 2
	},
	root_floating: {
		position: 'absolute',
		bottom: Sizes.Semantic.layoutPadding.m,
		right: Sizes.Semantic.layoutPadding.m
	},
	surface: {
		width: '100%',
		height: '100%',
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
