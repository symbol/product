import { Sizes } from '@/app/styles';
import { View } from 'react-native';

/** @typedef {import('react')} React */

const DEFAULT_VALUE = 'm';

/**
 * Spacer component. A layout component providing configurable padding around child content, supporting individual side controls.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {string} [props.x='m'] - Horizontal padding size ('s', 'm', 'l', etc.)
 * @param {string} [props.y='m'] - Vertical padding size ('s', 'm', 'l', etc.)
 * @param {string} [props.left] - Left padding size ('s', 'm', 'l', etc.)
 * @param {string} [props.right] - Right padding size ('s', 'm', 'l', etc.)
 * @param {string} [props.top] - Top padding size ('s', 'm', 'l', etc.)
 * @param {string} [props.bottom] - Bottom padding size ('s', 'm', 'l', etc.)
 *
 * @returns {React.ReactNode} Spacer layout component
 */
export const Spacer = ({ 
	children,
	style: customStyle,
	x = DEFAULT_VALUE, 
	y = DEFAULT_VALUE,
	left, 
	right,
	top, 
	bottom 
}) => {
	const style = {
		paddingLeft: Sizes.Semantic.layoutSpacing[left] ?? Sizes.Semantic.layoutSpacing[x],
		paddingRight: Sizes.Semantic.layoutSpacing[right] ?? Sizes.Semantic.layoutSpacing[x],
		paddingTop: Sizes.Semantic.layoutSpacing[top] ?? Sizes.Semantic.layoutSpacing[y],
		paddingBottom: Sizes.Semantic.layoutSpacing[bottom] ?? Sizes.Semantic.layoutSpacing[y]
	};
	return (
		<View style={[style, customStyle]}>
			{children}
		</View>
	);
};
