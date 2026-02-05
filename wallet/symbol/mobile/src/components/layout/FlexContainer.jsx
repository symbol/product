import { View } from 'react-native';

/** @typedef {import('react')} React */

/**
 * FlexContainer component. A flexible container component with configurable alignment options, direction, and space filling capabilities.
 * 
 * @param {object} props - Component props
 * @param {boolean} [props.center=false] - Center content both vertically and horizontally
 * @param {boolean} [props.left=false] - Align content to the left
 * @param {boolean} [props.right=false] - Align content to the right
 * @param {boolean} [props.top=false] - Align content to the top
 * @param {boolean} [props.bottom=false] - Align content to the bottom
 * @param {'row' | 'column'} [props.direction='column'] - Flex direction
 * @param {boolean} [props.fill=false] - Fill available space
 * @param {object} [props.style] - Additional styles for the container
 * @param {React.ReactNode} props.children - Child components
 * 
 * @returns {React.ReactNode} Flexible container component
 */
export const FlexContainer = ({
	center = false,
	left = false,
	right = false,
	top = false,
	bottom = false,
	direction = 'column',
	fill = false,
	style: customStyle,
	children 
}) => {
	const columnStyleMap = {
		center: {
			justifyContent: 'center',
			alignItems: 'center'
		},
		left: {
			alignItems: 'flex-start'
		},
		right: {
			alignItems: 'flex-end'
		},
		top: {
			justifyContent: 'flex-start'
		},
		bottom: {
			justifyContent: 'flex-end'
		}
	};
	const rowStyleMap = {
		center: {
			justifyContent: 'center',
			alignItems: 'center'
		},
		left: {
			justifyContent: 'flex-start'
		},
		right: {
			justifyContent: 'flex-end'
		},
		top: {
			alignItems: 'flex-start'
		},
		bottom: {
			alignItems: 'flex-end'
		}
	};

	const styleMap = direction === 'column' ? columnStyleMap : rowStyleMap;

	const style = [
		{ flexDirection: direction },
		fill && { flex: 1 },
		center && styleMap.center,
		left && styleMap.left,
		right && styleMap.right,
		top && styleMap.top,
		bottom && styleMap.bottom,
		customStyle
	];

	return (
		<View style={style}>
			{children}
		</View>
	);
};
