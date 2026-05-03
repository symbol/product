import { Colors, Sizes } from '@/app/styles';
import { View } from 'react-native';

/** @typedef {import('react')} React */

const DEFAULT_ORIENTATION = 'horizontal';
const WIDTH = Sizes.Semantic.borderWidth.s;
const COLOR_DEFAULT = Colors.Components.divider.default.background;
const COLOR_INVERSE = Colors.Components.divider.inverted.background;
const COLOR_ACCENT = Colors.Components.divider.accent.background;

/**
 * Divider component. A visual separator used to divide content areas, supporting horizontal and vertical orientations.
 * @param {object} props - Component props.
 * @param {'horizontal'|'vertical'} [props.orientation='horizontal'] - Orientation of the divider.
 * @param {string} [props.color] - Color of the divider. Defaults to the standard card background color.
 * @param {boolean} [props.inverse=false] - If true, uses the inverted default color.
 * @param {boolean} [props.accent=false] - If true, uses the accent color. Overrides inverse and color props.
 * @returns {React.ReactNode} Divider component.
 */
export const Divider = ({
	orientation = DEFAULT_ORIENTATION,
	color = COLOR_DEFAULT,
	inverse = false,
	accent = false
}) => {
	const dynamicStyle = {
		backgroundColor: accent ? COLOR_ACCENT : inverse ? COLOR_INVERSE : color,
		width: orientation === 'horizontal' ? '100%' : WIDTH,
		height: orientation === 'horizontal' ? WIDTH : '100%'
	};

	return (
		<View style={dynamicStyle} />
	);
};
