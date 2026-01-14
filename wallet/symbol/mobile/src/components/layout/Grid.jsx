import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

const GRID_SIZE = 8;
const GRID_COLOR = '#888a';

/**
 * Grid layout component. Used for development purposes only.
 * Helps to align elements on the screen and ensure consistent spacing.
 *
 * @returns {React.ReactNode}
 */
export const Grid = ({ isVisible }) => {
	if (!isVisible)
		return null;

	const dimensions = Dimensions.get('window');
	const { width } = dimensions;
	const height = dimensions.height - 100;

	const verticalCount = Math.trunc(width / 2 / GRID_SIZE);
	const upperCount = Math.trunc(height / 4 * 3 / GRID_SIZE);
	const bottomCount = Math.trunc(height / 4 * 1 / GRID_SIZE);

	const verticalLines = [];
	for (let i = 0; i < verticalCount; i += 2) {
		verticalLines.push({ key: `v-left-${i}`, style: { left: i * GRID_SIZE } });
		verticalLines.push({ key: `v-right-${i}`, style: { right: i * GRID_SIZE } });
	}

	const horizontalLines = [];
	for (let i = 0; i < upperCount; i += 2) 
		horizontalLines.push({ key: `h-top-${i}`, style: { top: i * GRID_SIZE } });
	
	for (let i = 0; i < bottomCount; i += 2) 
		horizontalLines.push({ key: `h-bottom-${i}`, style: { bottom: i * GRID_SIZE } });
	
	return (
		<View style={styles.root}>
			{verticalLines.map(line => (
				<View key={line.key} style={[styles.verticalLine, line.style]} />
			))}
			{horizontalLines.map(line => (
				<View key={line.key} style={[styles.horizontalLine, line.style]} />
			))}
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
	verticalLine: {
		position: 'absolute',
		top: 0,
		height: '100%',
		width: GRID_SIZE,
		backgroundColor: GRID_COLOR
	},
	horizontalLine: {
		position: 'absolute',
		left: 0,
		width: '100%',
		height: GRID_SIZE,
		backgroundColor: GRID_COLOR
	}
});
