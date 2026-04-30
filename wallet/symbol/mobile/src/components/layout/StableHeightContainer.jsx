import { useCallback, useState } from 'react';
import { View } from 'react-native';

/** @typedef {import('react')} React */

/**
 * StableHeightContainer component. A layout component that locks its height to the maximum
 * observed content height, preventing layout shifts when child content dynamically changes
 * size or is conditionally rendered.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components.
 * @param {object} [props.style] - Additional styles for the root View element.
 * @returns {React.ReactNode} StableHeightContainer layout component.
 */
export const StableHeightContainer = ({ children, style }) => {
	const [height, setHeight] = useState(0);

	const handleLayout = useCallback(event => {
		const { height: measuredHeight } = event.nativeEvent.layout;
		setHeight(prev => Math.max(prev, measuredHeight));
	}, []);

	return (
		<View style={[{ minHeight: height }, style]} onLayout={handleLayout}>
			{children}
		</View>
	);
};
