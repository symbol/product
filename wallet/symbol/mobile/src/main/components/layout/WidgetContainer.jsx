import { Card } from './Card';
import { Icon, StyledText, TouchableNative } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import { StyleSheet } from 'react-native';

/** @typedef {import('react')} React */

/**
 * WidgetContainer component. A reusable card layout for home screen widgets, providing
 * a pressable title header and a content area for widget-specific children.
 * @param {object} props - Component props.
 * @param {string} props.title - Widget title displayed in the header.
 * @param {function(): void} props.onHeaderPress - Callback invoked when the header is pressed.
 * @param {string} [props.backgroundColor] - Background color for the widget container.

 * @param {React.ReactNode} props.children - Content to render below the header.
 * @returns {React.ReactNode} WidgetContainer component.
 */
export const WidgetContainer = ({ title, onHeaderPress, backgroundColor, children }) => (
	<Card style={styles.root} color={backgroundColor}>
		<TouchableNative
			style={styles.header} 
			color={Colors.Components.cardHeader.background}
			colorPressed={Colors.Components.card.background}
			onPress={onHeaderPress} 
		>
			<StyledText type="label">
				{title}
			</StyledText>
			<Icon name="open" size="xs" />
		</TouchableNative>
		{children}
	</Card>
);

const styles = StyleSheet.create({
	root: {
		overflow: 'hidden'
	},
	header: {
		paddingHorizontal: Sizes.Semantic.layoutSpacing.m,
		paddingVertical: Sizes.Semantic.layoutSpacing.s,
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.layoutSpacing.s
	}
});
