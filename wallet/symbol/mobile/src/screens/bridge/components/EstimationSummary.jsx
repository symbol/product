import { PriceImpactSeverity } from '../constants';
import { Card, Icon, LoadingIndicator, Spacer, Stack, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

/** @typedef {import('@/app/screens/bridge/types/ViewModel').EstimationSummaryViewModel} EstimationSummaryViewModel */

const severityAppearanceMap = {
	[PriceImpactSeverity.WARNING]: {
		iconName: 'alert-warning',
		iconVariant: 'warning',
		color: Colors.Semantic.role.warning.default
	},
	[PriceImpactSeverity.CRITICAL]: {
		iconName: 'alert-danger',
		iconVariant: 'danger',
		color: Colors.Semantic.role.danger.default
	}
};

/**
 * EstimationSummary component. Displays the summary card based on its view model.
 * @param {object} props - Component props.
 * @param {EstimationSummaryViewModel} props.summary - Ready rows and the pair key.
 * @param {boolean} props.isLoading - Whether any summary input is being fetched.
 * @returns {React.ReactNode} EstimationSummary component.
 */
export const EstimationSummary = ({ summary, isLoading }) => (
	<Card color={Colors.Components.summary.background}>
		<Spacer>
			<Stack>
				<View style={styles.summaryRow}>
					<StyledText type="label">
						{$t('s_bridge_summary_title')}
					</StyledText>
					{isLoading && (
						<View style={styles.loadingIndicator}>
							<LoadingIndicator size="sm" />
						</View>
					)}
				</View>
				<Animated.View
					entering={FadeIn}
					exiting={FadeOut}
					key={summary.key}
					style={styles.summaryBody}
				>
					{summary.rows.map((row, index) => {
						const appearance = row.severity ? severityAppearanceMap[row.severity] : null;

						return (
							<View style={styles.summaryRow} key={index}>
								{row.isContinuation ? (
									<View accessible accessibilityLabel={row.title} style={styles.connector} />
								) : (
									<StyledText>
										{row.title}
									</StyledText>
								)}
								<View style={styles.summaryValue}>
									{!!appearance && (
										<Icon
											name={appearance.iconName}
											variant={appearance.iconVariant}
											size="xs"
											style={styles.valueIcon}
										/>
									)}
									<StyledText style={appearance && { color: appearance.color }}>
										{row.value}
									</StyledText>
								</View>
							</View>
						);
					})}
				</Animated.View>
			</Stack>
		</Spacer>
	</Card>
);

const styles = StyleSheet.create({
	summaryRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '100%'
	},
	summaryValue: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	connector: {
		width: Sizes.Semantic.spacing.m,
		height: Sizes.Semantic.spacing.m,
		marginLeft: Sizes.Semantic.spacing.s,
		alignSelf: 'flex-start',
		borderLeftWidth: Sizes.Semantic.borderWidth.s,
		borderBottomWidth: Sizes.Semantic.borderWidth.s,
		borderColor: Colors.Semantic.role.neutral.default
	},
	valueIcon: {
		marginRight: Sizes.Semantic.spacing.xs
	},
	loadingIndicator: {
		position: 'absolute',
		top: Sizes.Semantic.spacing.m,
		right: Sizes.Semantic.spacing.m
	}
});
