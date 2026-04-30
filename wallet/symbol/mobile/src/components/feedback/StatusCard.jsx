import { Card, Icon, LoadingIndicator, Spacer, Stack, StyledText } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const CONTENT_COLOR = Colors.Semantic.content.primary.inverse;
const ICON_SIZE = 'm';
const ICON_SIZE_VALUE = Sizes.Semantic.iconSize[ICON_SIZE];

/**
 * StatusCard component. A card component for displaying status information with an icon,
 * supporting various visual variants and optional additional content.
 * @param {object} props - Component props.
 * @param {import('@/app/types/ColorVariants').SemanticRoleColorVariants} [props.variant='neutral'] - Status variant.
 * determining the card background color.
 * @param {string} props.statusText - Text to display as the primary status message.
 * @param {string} props.icon - Icon name to display alongside the status text.
 * @param {boolean} [props.isLoading=false] - Whether to show a loading spinner instead of the icon.
 * @param {React.ReactNode} [props.children] - Additional content to display below the status row.
 * @returns {React.ReactNode} StatusCard component.
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
								size={ICON_SIZE}
								variant="inverse"
							/>
						)}
						{isLoading && (
							<View style={styles.loadingIndicator}>
								<LoadingIndicator size="sm" color={CONTENT_COLOR} />
							</View>
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
	},
	loadingIndicator: {
		width: ICON_SIZE_VALUE,
		height: ICON_SIZE_VALUE,
		justifyContent: 'center',
		alignItems: 'center'
	}
});
