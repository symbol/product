import { Sizes } from '@/app/styles';
import { Children } from 'react';
import { View } from 'react-native';

/** @typedef {import('react')} React */

const DEFAULT_GAP = 'none';

/**
 * Columns component. A columns component arranging child elements in multiple columns with the same size.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {string} [props.gap='none'] - Gap size between children ('s', 'm', 'l', etc.)
 * @returns {React.ReactNode} Columns layout component
 */
export const Columns = ({ children, gap = DEFAULT_GAP }) => {
	const normalizedChildren = Children.toArray(children);
	const style = {
		flexDirection: 'row',
		alignItems: 'stretch',
		gap: Sizes.Semantic.layoutSpacing[gap]
	};
	const columnStyle = {
		flex: 1,
		minWidth: 0
	};

	return (
		<View style={style}>
			{normalizedChildren.map((child, index) => (
				<View key={index} style={columnStyle}>
					{child}
				</View>
			))}
		</View>
	);
};
