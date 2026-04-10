import { Colors } from '@/app/styles';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const DEFAULT_COLOR = Colors.Components.loadingIndicator.surface;
/**
 * LoadingIndicator component. A loading spinner in small or large sizes.
 * 
 * @param {object} props - Component props
 * @param {'sm'|'lg'} [props.size='lg'] - Size of the loading indicator
 * @param {string} [props.color] - Color of the loading spinner, defaults to theme color
 * 
 * @returns {React.ReactNode} Loading indicator component
 */
export const LoadingIndicator = props => {
	const { size, color = DEFAULT_COLOR } = props;
	const indicatorSize = size === 'sm' ? 'small' : 'large';

	return (
		<View style={styles.root} testID="loading-indicator">
			<View style={styles.spinnerContainer}>
				<ActivityIndicator size={indicatorSize} color={color} />
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%'
	},
	spinnerContainer: {
		flex: 1,
		width: '100%',
		justifyContent: 'center'
	}
});
