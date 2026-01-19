import { Card, Icon, Spacer, Stack, StyledText } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const CONTENT_COLOR = Colors.Semantic.content.primary.inverse;

/**
 * StatusCard component
 *
 * A specialized card component for displaying status information with an icon or loading indicator.
 * It combines a Card with status-specific styling and supports different variants for various
 * states like success, warning, or error. The component includes a minimum height and proper
 * spacing for consistent status display across the application.
 *
 * @param {object} props - Component props
 * @param {import('@/app/types/ColorVariants').SemanticRoleColorVariants} [props.variant='neutral'] - Status variant
 * determining the card background color.
 * @param {string} props.statusText - Text to display as the primary status message.
 * @param {string} props.icon - Icon name to display alongside the status text.
 * @param {boolean} [props.isLoading=false] - Whether to show a loading spinner instead of the icon.
 * @param {React.ReactNode} [props.children] - Additional content to display below the status row.
 *
 * @returns {React.ReactNode} Rendered StatusCard component
 */
export const StatusCard = ({ variant = 'neutral', statusText, icon, isLoading, children }) => {
	const pallette = Colors.Components.statusCard[variant];

	return (
		<Card color={pallette.background} style={styles.root}>
			<Spacer>
				<Stack>
					<View style={styles.statusRow}>
						{!isLoading && (
							<Icon
								name={icon}
								size="m"
								variant="inverse"
							/>
						)}
						{isLoading && (
							<ActivityIndicator
								style={styles.statusIcon}
								size="small"
								color={CONTENT_COLOR}
							/>
						)}
						<StyledText size="xl" inverse>
							{statusText}
						</StyledText>
					</View>
					{children}
				</Stack>
			</Spacer>
		</Card>
	);
};

const styles = StyleSheet.create({
	root: {
		minHeight: Sizes.Semantic.spacing.m * 16
	},
	statusRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.m
	}
});
