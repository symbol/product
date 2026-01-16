import { Sizes } from '@/app/styles';
import { View } from 'react-native';

/** @typedef {import('react')} React */

const DEFAULT_GAP = 'm';
const DEFAULT_DIRECTION = 'column';

/**
 * Stack layout component with configurable gap between children
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {string} [props.gap='m'] - Gap size between children ('s', 'm', 'l', etc.)
 * @param {string} [props.direction='column'] - Flex direction ('row' or 'column')
 * 
 * @returns {React.ReactNode} Stack layout component
 */
export const Stack = ({ children, gap = DEFAULT_GAP, direction = DEFAULT_DIRECTION }) => {
	const style = {
		gap: Sizes.Semantic.layoutSpacing[gap],
		flexDirection: direction
	};

	return (
		<View style={style}>
			{children}
		</View>
	);
};
