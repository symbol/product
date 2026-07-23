import { Card, Divider, Field, Icon, StyledText, TokenInfoView } from '@/app/components';
import { $t } from '@/app/localization';
import { createSupplyDisplayData, getSmallestFractionText } from '@/app/screens/mosaic/utils';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/**
 * SupplyAmount component. Renders the total supply preview digits: the entered amount in full with the
 * unused decimal capacity dimmed. The decimal separator and zero padding are shown only when the mosaic
 * is divisible. The digit groups are announced as one amount, as reading them apart carries no meaning.
 * @param {object} props - Component props.
 * @param {string} props.integer - The grouped integer part of the supply.
 * @param {string} props.enteredFraction - The fractional digits the user entered.
 * @param {string} props.paddingFraction - The unused decimal-capacity zero padding.
 * @param {number} props.divisibility - The mosaic divisibility.
 * @returns {React.ReactNode} SupplyAmount component.
 */
const SupplyAmount = ({ integer, enteredFraction, paddingFraction, divisibility }) => {
	const isDivisible = divisibility > 0;
	const separatorVariant = enteredFraction ? 'primary' : 'secondary';
	const amountText = isDivisible ? `${integer}.${enteredFraction}${paddingFraction}` : integer;

	return (
		<View style={styles.amountRow} accessible accessibilityLabel={amountText}>
			<StyledText bold size="l">{integer}</StyledText>
			{isDivisible && (
				<Animated.View
					key={divisibility}
					entering={FadeIn}
					style={styles.amountRow}
				>
					<StyledText bold size="l" variant={separatorVariant}>.</StyledText>
					{!!enteredFraction && (
						<StyledText bold>{enteredFraction}</StyledText>
					)}
					{!!paddingFraction && (
						<StyledText bold variant="secondary">{paddingFraction}</StyledText>
					)}
				</Animated.View>
			)}
		</View>
	);
};

/**
 * MosaicPreviewCard component. A read-only receipt of the mosaic being created: the token identity above
 * the total supply, rendered with the entered amount in full and the unused decimal capacity dimmed,
 * followed by the smallest sendable amount and a note that the decimal places are permanent.
 * @param {object} props - Component props.
 * @param {string} props.supply - The mosaic supply input value in relative units.
 * @param {string|number} props.divisibility - The current divisibility input value.
 * @param {string} [props.mosaicId] - The derived mosaic id, when the creator is known.
 * @returns {React.ReactNode} MosaicPreviewCard component.
 */
export const MosaicPreviewCard = ({ supply, divisibility, mosaicId }) => {
	const divisibilityValue = Number(divisibility);
	const isDivisible = divisibilityValue > 0;
	const supplyDisplay = createSupplyDisplayData(supply, divisibilityValue);
	const smallestSendText = getSmallestFractionText(divisibilityValue);
	const wholeTokensText = $t('s_mosaicCreation_smallestSend_whole');
	const smallestSendValueText = isDivisible ? smallestSendText : `${smallestSendText} ${wholeTokensText}`;

	return (
		<Card style={styles.card}>
			<TokenInfoView
				name={$t('s_mosaicCreation_namePlaceholder')}
				id={mosaicId}
			/>
			<Field title={$t('s_mosaicCreation_totalSupply_label')} size="s" alignRight>
				<SupplyAmount
					integer={supplyDisplay.integer}
					enteredFraction={supplyDisplay.enteredFraction}
					paddingFraction={supplyDisplay.paddingFraction}
					divisibility={divisibilityValue}
				/>
			</Field>
			<Field title={$t('s_mosaicCreation_smallestSend_label')} size="s">
				<View
					style={styles.smallestSendRow}
					accessible
					accessibilityLabel={smallestSendValueText}
				>
					<StyledText bold>{smallestSendText}</StyledText>
					{!isDivisible && (
						<StyledText size="s">{wholeTokensText}</StyledText>
					)}
				</View>
			</Field>
			<Divider accent />
			<View style={styles.noteRow}>
				<Icon name="info-circle" size="xxs" />
				<StyledText size="s" variant="secondary" style={styles.noteText}>
					{$t('s_mosaicCreation_decimalsNote')}
				</StyledText>
			</View>
		</Card>
	);
};

const styles = StyleSheet.create({
	card: {
		padding: Sizes.Semantic.layoutPadding.m,
		gap: Sizes.Semantic.spacing.m
	},
	amountRow: {
		flexDirection: 'row',
		alignItems: 'baseline'
	},
	smallestSendRow: {
		flexDirection: 'row',
		alignItems: 'baseline',
		gap: Sizes.Semantic.spacing.s
	},
	noteRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.s
	},
	noteText: {
		flex: 1
	}
});
