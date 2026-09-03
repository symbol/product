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
/** @typedef {import('@/app/screens/bridge/types/Bridge').FeeGroup} FeeGroup */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapToken} SwapToken */

const MISSING_VALUE_TEXT = '-';

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
 * Formats a summary row value with its units, or the placeholder when the value is unavailable, so
 * every row keeps a value instead of an empty gap next to its title.
 * @param {string|null|undefined} value - Row value.
 * @param {string} [units] - Units shown after the value.
 * @returns {string} Row value text.
 */
const formatRowValue = (value, units) => {
	if (!value)
		return MISSING_VALUE_TEXT;

	return [value, units].filter(Boolean).join(' ');
};

/**
 * Builds the summary rows for one fee kind from its display groups. The first group keeps the titled
 * row; every extra group becomes a continuation row, marked to render a connector in place of the
 * title. Falls back to a single placeholder row when there are no groups.
 * @param {string} title - Row title.
 * @param {FeeGroup[]} groups - Display fee groups.
 * @returns {object[]} Summary row descriptors.
 */
const createFeeGroupRows = (title, groups) => {
	if (!groups?.length)
		return [{ title, value: MISSING_VALUE_TEXT }];

	return groups.map((group, index) => ({
		title,
		value: formatRowValue(group.amount, group.tokenName),
		isContinuation: index > 0
	}));
};

/**
 * Builds the price difference row of the summary. The row shows the placeholder when no step involves
 * a swap. The row severity pairs a color with an icon and a level word, so the warning does not rely
 * on color alone.
 * @param {BridgeEstimation[]|null} estimations - Bridge estimation data.
 * @returns {object} Summary row descriptor.
 */
const createPriceImpactRow = estimations => {
	const priceImpact = getEstimationsPriceImpact(estimations);
	const title = $t('s_bridge_summary_priceImpact');

	if (priceImpact === undefined)
		return { title, value: MISSING_VALUE_TEXT };

	const severity = getPriceImpactSeverity(priceImpact, config.bridge.priceImpact);
	const appearance = severityAppearanceMap[severity];

	if (priceImpact === null)
		return { title, value: $t('s_bridge_summary_priceImpact_unknown'), appearance };

	return {
		title,
		value: formatRowValue(formatPriceImpactText(priceImpact), appearance && `· ${$t(appearance.levelTextKey)}`),
		appearance
	};
};

/**
 * EstimationSummary component. Displays swap estimation details including send amount,
 * transaction fees, operation fees, price difference, and expected receive amount. Fee rows come
 * pre-grouped: extra groups of a fee kind render as continuation rows connected to the titled row.
 * @param {object} props - Component props.
 * @param {string} props.sendAmount - Amount being sent.
 * @param {FeeGroup[]} props.transactionFeeGroups - Transaction (gas) fee display groups.
 * @param {FeeGroup[]} props.operationFeeGroups - Operation fee display groups.
 * @param {BridgeEstimation[]|null} props.estimations - Bridge estimation data.
 * @param {SwapToken|null} props.sourceToken - Source token info.
 * @param {SwapToken|null} props.targetToken - Target token info.
 * @param {boolean} props.isLoading - Whether estimation is loading.
 * @returns {React.ReactNode} EstimationSummary component.
 */
export const EstimationSummary = ({
	sendAmount,
	transactionFeeGroups,
	operationFeeGroups,
	estimations,
	sourceToken,
	targetToken,
	isLoading
}) => {
	const estimation = estimations?.[estimations.length - 1] ?? null;
	const summary = [
		{
			title: $t('s_bridge_summary_amountSend'),
			value: formatRowValue(sourceToken ? sendAmount : null, sourceToken?.name)
		},
		...createFeeGroupRows($t('s_bridge_summary_transactionFee'), transactionFeeGroups),
		...createFeeGroupRows($t('s_bridge_summary_bridgeFee'), operationFeeGroups),
		createPriceImpactRow(estimations),
		{
			title: $t('s_bridge_summary_amountReceive'),
			value: formatRowValue(targetToken ? estimation?.receiveAmount : null, targetToken?.name)
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
								{item.isContinuation ? (
									<View accessible accessibilityLabel={item.title} style={styles.connector} />
								) : (
									<StyledText>
										{item.title}
									</StyledText>
								)}
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
										{item.value}
									</StyledText>
								</View>
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
