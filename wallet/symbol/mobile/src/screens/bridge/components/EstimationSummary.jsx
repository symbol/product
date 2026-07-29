import { PriceImpactSeverity } from '../constants';
import { formatPriceImpactText, getEstimationsPriceImpact, getPriceImpactSeverity } from '../utils';
import { Card, Icon, LoadingIndicator, Spacer, Stack, StyledText } from '@/app/components';
import { config } from '@/app/config';
import { $t } from '@/app/localization';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapToken} SwapToken */
/** @typedef {import('@/app/types/Network').NetworkCurrency} NetworkCurrency */

const severityAppearanceMap = {
	[PriceImpactSeverity.WARNING]: {
		iconName: 'alert-warning',
		iconVariant: 'warning',
		color: Colors.Semantic.role.warning.default,
		levelTextKey: 's_bridge_summary_priceImpact_high'
	},
	[PriceImpactSeverity.CRITICAL]: {
		iconName: 'alert-danger',
		iconVariant: 'danger',
		color: Colors.Semantic.role.danger.default,
		levelTextKey: 's_bridge_summary_priceImpact_veryHigh'
	}
};

/**
 * Builds the price difference row of the summary, or null when no step involves a swap. The row
 * severity pairs a color with an icon and a level word, so the warning does not rely on color alone.
 * @param {BridgeEstimation[]|null} estimations - Bridge estimation data.
 * @returns {object|null} Summary row descriptor, or null when the row does not apply.
 */
const createPriceImpactRow = estimations => {
	const priceImpact = getEstimationsPriceImpact(estimations);

	if (priceImpact === undefined)
		return null;

	const severity = getPriceImpactSeverity(priceImpact, config.bridge.priceImpact);
	const appearance = severityAppearanceMap[severity];
	const isUnknown = priceImpact === null;

	return {
		title: $t('s_bridge_summary_priceImpact'),
		isShown: true,
		amount: isUnknown ? $t('s_bridge_summary_priceImpact_unknown') : formatPriceImpactText(priceImpact),
		units: !isUnknown && appearance ? `· ${$t(appearance.levelTextKey)}` : '',
		appearance
	};
};

/**
 * EstimationSummary component. Displays swap estimation details including send amount,
 * transaction fee, bridge fee, price difference, and expected receive amount.
 * @param {object} props - Component props.
 * @param {string} props.sendAmount - Amount being sent.
 * @param {string} props.transactionFeeAmount - Transaction fee amount.
 * @param {BridgeEstimation[]|null} props.estimations - Bridge estimation data.
 * @param {SwapToken|null} props.sourceToken - Source token info.
 * @param {SwapToken|null} props.targetToken - Target token info.
 * @param {NetworkCurrency|null} props.sourceNetworkCurrency - Source network native currency info.
 * @param {boolean} props.isLoading - Whether estimation is loading.
 * @returns {React.ReactNode} EstimationSummary component.
 */
export const EstimationSummary = ({
	sendAmount,
	transactionFeeAmount,
	estimations,
	sourceToken,
	targetToken,
	sourceNetworkCurrency,
	isLoading
}) => {
	const estimation = estimations?.[estimations.length - 1] ?? null;
	const priceImpactRow = createPriceImpactRow(estimations);
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
		...(priceImpactRow ? [priceImpactRow] : []),
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
									<View style={styles.summaryValue}>
										{!!item.appearance && (
											<Icon
												name={item.appearance.iconName}
												variant={item.appearance.iconVariant}
												size="xs"
												style={styles.valueIcon}
											/>
										)}
										<StyledText style={item.appearance && { color: item.appearance.color }}>
											{item.amount} {item.units}
										</StyledText>
									</View>
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
	summaryValue: {
		flexDirection: 'row',
		alignItems: 'center'
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
