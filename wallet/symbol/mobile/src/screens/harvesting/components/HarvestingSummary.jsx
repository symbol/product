import { Amount, Card, Divider, Spacer, Stack, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { Colors } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/screens/harvesting/utils/harvesting-summary').HarvestingSummaryViewModel} HarvestingSummaryViewModel */

/**
 * HarvestingSummary component. Displays harvesting summary including latest harvested block
 * and 30-day statistics.
 * @param {object} props - Component props.
 * @param {HarvestingSummaryViewModel} props.summaryViewModel - Summary view model.
 * @param {string} props.ticker - Currency ticker symbol.
 * @returns {React.ReactNode} HarvestingSummary component.
 */
export const HarvestingSummary = ({ summaryViewModel, ticker }) => {
	const {
		latestAmount,
		latestBlockNumber,
		latestDate,
		amountPer30Days,
		blocksCount
	} = summaryViewModel;

	const latestBlockNumberText = latestBlockNumber ? `#${latestBlockNumber}` : '-';

	return (
		<Card color={Colors.Components.summary.background}>
			<Spacer>
				<Stack gap="s">
					<View style={styles.row}>
						<StyledText>
							{$t('s_harvesting_harvested_block_label')}
						</StyledText>
						<View style={styles.alignRight}>
							<Amount
								value={latestAmount}
								ticker={ticker}
								size="m"
							/>
							<StyledText type="body">
								{latestBlockNumberText}
							</StyledText>
							<StyledText
								type="body"
								size="s"
								variant="secondary"
							>
								{latestDate}
							</StyledText>
						</View>
					</View>
					<Divider />
					<View style={styles.row}>
						<StyledText>
							{$t('s_harvesting_harvested_30days_label')}
						</StyledText>
						<View style={styles.alignRight}>
							<Amount
								value={amountPer30Days}
								ticker={ticker}
								size="m"
							/>
							<StyledText type="body">
								{blocksCount}
							</StyledText>
						</View>
					</View>
				</Stack>
			</Spacer>
		</Card>
	);
};

const styles = StyleSheet.create({
	alignRight: {
		alignItems: 'flex-end'
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '100%'
	}
});
