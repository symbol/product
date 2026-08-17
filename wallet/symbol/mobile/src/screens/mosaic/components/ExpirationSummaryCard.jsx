import { Card, Field, Spacer, Stack, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { getBlockCountText, parseDurationBlocks } from '@/app/screens/mosaic/utils';
import { blockDurationToDaysLeft } from '@/app/utils';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * ExpirationSummaryCard component. The read-only summary card echoing when the mosaic expires: a
 * permanence note when never expiring, otherwise the exact block count with the approximate human
 * lifetime beside it.
 * @param {object} props - Component props.
 * @param {string} props.duration - The duration form value in blocks.
 * @param {string|number} [props.blockGenerationTargetTime] - The network block time in seconds.
 * @param {boolean} props.isNeverExpiring - Whether the never expiring mode is on.
 * @returns {React.ReactNode} ExpirationSummaryCard component.
 */
export const ExpirationSummaryCard = ({ duration, blockGenerationTargetTime, isNeverExpiring }) => {
	const blocks = parseDurationBlocks(duration);
	const blockTime = Number(blockGenerationTargetTime);
	const blocksText = blocks === null ? '—' : getBlockCountText(blocks);
	const isDaysLeftVisible = blocks !== null && !!blockTime && !isNeverExpiring;

	return (
		<Card>
			<Spacer>
				<Stack gap="none">
					<Field title={$t('s_mosaicCreation_expiration_title')}>
						<View style={styles.summaryRow}>
							{isNeverExpiring && (
								<StyledText type="body">
									{$t('s_mosaicCreation_expiration_permanent')}
								</StyledText>
							)}
							{!isNeverExpiring && (
								<StyledText type="label">
									{blocksText}
								</StyledText>
							)}
							{isDaysLeftVisible && (
								<StyledText type="body" size="s">
									{`~ ${blockDurationToDaysLeft(blocks, blockTime)}`}
								</StyledText>
							)}
						</View>
					</Field>
				</Stack>
			</Spacer>
		</Card>
	);
};

const styles = StyleSheet.create({
	summaryRow: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	}
});
