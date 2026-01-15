import { Colors, Sizes } from '@/app/styles';
import { View } from 'react-native';

/** @typedef {import('react')} React */

const DEFAULT_BORDER_RADIUS = 'm';

/**
 * Card layout component.
 *
 * A basic container component that provides a background color and rounded corners for grouping
 * related content. It's designed to be a simple wrapper without built-in padding or margins,
 * allowing for flexible layout composition. Commonly used for displaying information panels,
 * forms, or any content that needs visual separation from the background.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components to be rendered inside the card.
 * @param {'s'|'m'|'l'} [props.borderRadius='m'] - Border radius size.
 * @param {string} [props.color] - Background color override. Defaults to the standard card background color.
 * @param {object} [props.style] - Additional styles for the container.
 *
 * @returns {React.ReactNode} Card component
 */
export const Card = ({
 	children,
	borderRadius = DEFAULT_BORDER_RADIUS,
	color = Colors.Components.card.background,
	style
}) => {
	const dynamicStyle = {
		backgroundColor: color,
		borderRadius: Sizes.Semantic.borderRadius[borderRadius]
	};

	return (
		<View style={[dynamicStyle, style]}>
			{children}
		</View>
	);
};
