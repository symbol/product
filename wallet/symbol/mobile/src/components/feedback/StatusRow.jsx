import { Icon, StyledText } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * StatusRow component.
 *
 * @param {object} props - Component props
 *
 * @returns {React.ReactNode} StatusRow component
 */
export const StatusRow = ({ variant = 'neutral', statusText, icon }) => {
	const pallette = Colors.Components.statusLabel[variant];
	const textStyle = {
		color: pallette.text
	};

	return (
		<View style={styles.root}>
			<Icon
				name={icon}
				size="s"
				variant={variant}
			/>
			<StyledText style={textStyle}>
				{statusText}
			</StyledText>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.s
	}
});
