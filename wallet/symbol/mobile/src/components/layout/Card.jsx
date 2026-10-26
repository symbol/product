import { Colors, Sizes } from '@/app/styles';
import { View } from 'react-native';

/** @typedef {import('react')} React */

/**
 * Card component. A container component providing background color and rounded corners for grouping
 * related content, supporting customizable border radius and color.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components to be rendered inside the card.
 * @param {string} [props.color] - Background color override. Defaults to the standard card background color.
 * @param {object} [props.style] - Additional styles for the container.
 * @returns {React.ReactNode} Card component.
 */
export const Card = ({
 	children,
	color = Colors.Components.card.background,
	style
}) => {
	const dynamicStyle = {
		backgroundColor: color,
		borderRadius: Sizes.Components.card.borderRadius
	};

	return (
		<View style={[dynamicStyle, style]}>
			{children}
		</View>
	);
};
