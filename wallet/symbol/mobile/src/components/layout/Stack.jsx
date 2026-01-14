import { Sizes } from '@/app/styles';
import { View } from 'react-native';

/** @typedef {import('react')} React */

const DEFAULT_VALUE = 'm';

/**
 * Stack layout component with configurable gap between children
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {string} [props.gap='m'] - Gap size between children ('s', 'm', 'l', etc.)
 * 
 * @returns {React.ReactNode} Stack layout component
 */
export const Stack = ({ children, gap = DEFAULT_VALUE }) => {
	const style = {
		gap: Sizes.Semantic.layoutSpacing[gap]
	};

	return (
		<View style={style}>
			{children}
		</View>
	);
};
