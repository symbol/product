import { Card, LoadingIndicator, Spacer, Stack, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapToken} SwapToken */
/** @typedef {import('@/app/types/Network').NetworkCurrency} NetworkCurrency */

/**
 * EstimationSummary component. Displays swap estimation details including send amount,
 * transaction fee, bridge fee, and expected receive amount.
 * @param {object} props - Component props.
 * @param {string} props.sendAmount - Amount being sent.
 * @param {string} props.transactionFeeAmount - Transaction fee amount.
 * @param {BridgeEstimation|null} props.estimation - Bridge estimation data.
 * @param {SwapToken|null} props.sourceToken - Source token info.
 * @param {SwapToken|null} props.targetToken - Target token info.
 * @param {NetworkCurrency|null} props.sourceNetworkCurrency - Source network native currency info.
 * @param {boolean} props.isLoading - Whether estimation is loading.
 * @returns {React.ReactNode} EstimationSummary component.
 */
export const EstimationSummary = ({
	sendAmount,
	transactionFeeAmount,
	estimation,
	sourceToken,
	targetToken,
	sourceNetworkCurrency,
	isLoading
}) => {
	const summary = [
		{
			title: $t('s_bridge_summary_amountSend'),
			isShown: !!sourceToken,
			amount: sourceToken ? sendAmount : '-',
			units: sourceToken ? sourceToken.name : ''
		},
		{
			title: $t('s_bridge_summary_transactionFee'),
			isShown: !!transactionFeeAmount && !!sourceNetworkCurrency,
			amount: transactionFeeAmount,
			units: sourceNetworkCurrency ? sourceNetworkCurrency.name : ''
		},
		{
			title: $t('s_bridge_summary_bridgeFee'),
			isShown: !!estimation && !!targetToken,
			amount: estimation?.bridgeFee ?? '-',
			units: targetToken ? targetToken.name : ''
		},
		{
			title: $t('s_bridge_summary_amountReceive'),
			isShown: !!estimation && !!targetToken,
			amount: estimation?.receiveAmount ?? '-',
			units: targetToken ? targetToken.name : ''
		}
	];

	return (
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
						key={`summary-${targetToken?.id}`}
						style={styles.summaryBody}
					>
						{summary.map((item, index) => (
							<View style={styles.summaryRow} key={index}>
								<StyledText>
									{item.title}
								</StyledText>
								{item.isShown && (
									<StyledText>
										{item.amount} {item.units}
									</StyledText>
								)}
							</View>
						))}
					</Animated.View>
				</Stack>
			</Spacer>
		</Card>
	);
};

const styles = StyleSheet.create({
	summaryRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '100%'
	},
	loadingIndicator: {
		position: 'absolute',
		top: Sizes.Semantic.spacing.m,
		right: Sizes.Semantic.spacing.m
	}
});
