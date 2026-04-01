import { Colors, Sizes } from '@/app/styles';
import { View } from 'react-native';

/** @typedef {import('react')} React */

const DEFAULT_ORIENTATION = 'horizontal';
const WIDTH = Sizes.Semantic.borderWidth.s;

/**
 * Divider component. A visual separator used to divide content areas, supporting horizontal and vertical orientations.
 *
 * @param {object} props - Component props
 * @param {'horizontal'|'vertical'} [props.orientation='horizontal'] - Orientation of the divider.
 * @param {string} [props.color] - Color of the divider. Defaults to the standard card background color.
 *
 * @returns {React.ReactNode} Divider component
 */
export const Divider = ({
	orientation = DEFAULT_ORIENTATION,
	color = Colors.Components.card.background
}) => {
	const dynamicStyle = {
		backgroundColor: color,
		width: orientation === 'horizontal' ? '100%' : WIDTH,
		height: orientation === 'horizontal' ? WIDTH : '100%'
	};

	return (
		<View style={dynamicStyle} />
	);
};
