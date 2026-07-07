import { Card, Divider, Icon, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { createSupplyDisplayData, getSmallestFractionText } from '@/app/screens/mosaic/utils';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const ICON_CIRCLE_SIZE = Sizes.Semantic.avatarHeight.l;

/**
 * SupplyAmount component. Renders the total supply preview digits: the entered amount in full with the
 * unused decimal capacity dimmed in the accent color. The decimal separator and zero padding are shown
 * only when the mosaic is divisible.
 * @param {object} props - Component props.
 * @param {string} props.integer - The grouped integer part of the supply.
 * @param {string} props.enteredFraction - The fractional digits the user entered.
 * @param {string} props.paddingFraction - The unused decimal-capacity zero padding.
 * @param {number} props.divisibility - The mosaic divisibility.
 * @returns {React.ReactNode} SupplyAmount component.
 */
const SupplyAmount = ({ integer, enteredFraction, paddingFraction, divisibility }) => {
	const separatorStyle = enteredFraction ? undefined : styles.amountCapacity;

	return (
		<View style={styles.amountRow}>
			<StyledText bold>{integer}</StyledText>
			{divisibility > 0 && (
				<Animated.View
					key={divisibility}
					entering={FadeIn}
					style={styles.amountRow}
				>
					<StyledText bold style={separatorStyle}>.</StyledText>
					{!!enteredFraction && (
						<StyledText bold>{enteredFraction}</StyledText>
					)}
					{!!paddingFraction && (
						<StyledText bold style={styles.amountCapacity}>{paddingFraction}</StyledText>
					)}
				</Animated.View>
			)}
		</View>
	);
};

/**
 * MosaicPreviewCard component. A read-only receipt of the mosaic being created: the identity row
 * (icon, name placeholder and derived mosaic id) beside the total supply rendered with the entered
 * amount in full and the unused decimal capacity dimmed, followed by the smallest sendable amount
 * and a note that the decimal places are permanent.
 * @param {object} props - Component props.
 * @param {string} props.supply - The mosaic supply input value in relative units.
 * @param {string|number} props.divisibility - The current divisibility input value.
 * @param {string} [props.mosaicId] - The derived mosaic id, when the creator is known.
 * @returns {React.ReactNode} MosaicPreviewCard component.
 */
export const MosaicPreviewCard = ({ supply, divisibility, mosaicId }) => {
	const divisibilityValue = Number(divisibility);
	const supplyDisplay = createSupplyDisplayData(supply, divisibilityValue);
	const smallestSendText = getSmallestFractionText(divisibilityValue);
	const totalSupplyLabel = $t('s_mosaicCreation_totalSupply_label');
	const smallestSendLabel = $t('s_mosaicCreation_smallestSend_label');

	const supplyValueText = divisibilityValue > 0
		? `${supplyDisplay.integer}.${supplyDisplay.enteredFraction}${supplyDisplay.paddingFraction}`
		: supplyDisplay.integer;
	const smallestSendValueText = divisibilityValue === 0
		? `${smallestSendText} ${$t('s_mosaicCreation_smallestSend_whole')}`
		: smallestSendText;

	return (
		<Card style={styles.card}>
			<View style={styles.identityRow}>
				<View style={styles.iconCircle}>
					<Icon name="token-custom" size="m" />
				</View>
				<View style={styles.nameColumn}>
					<StyledText type="body" bold>
						{$t('s_mosaicCreation_namePlaceholder')}
					</StyledText>
					{!!mosaicId && (
						<StyledText type="body" size="s" style={styles.mosaicId} numberOfLines={1}>
							{mosaicId}
						</StyledText>
					)}
				</View>
				<View
					style={styles.amountColumn}
					accessible
					accessibilityLabel={`${totalSupplyLabel} ${supplyValueText}`}
				>
					<StyledText type="label" size="s" style={styles.mutedText}>
						{totalSupplyLabel}
					</StyledText>
					<SupplyAmount
						integer={supplyDisplay.integer}
						enteredFraction={supplyDisplay.enteredFraction}
						paddingFraction={supplyDisplay.paddingFraction}
						divisibility={divisibilityValue}
					/>
				</View>
			</View>
			<Divider />
			<View
				style={styles.detailRow}
				accessible
				accessibilityLabel={`${smallestSendLabel} ${smallestSendValueText}`}
			>
				<StyledText type="body" size="s" style={styles.mutedText}>
					{smallestSendLabel}
				</StyledText>
				<View style={styles.fractionRow}>
					<StyledText bold>
						{smallestSendText}
					</StyledText>
					{divisibilityValue === 0 && (
						<StyledText size="s">
							{$t('s_mosaicCreation_smallestSend_whole')}
						</StyledText>
					)}
				</View>
			</View>
			<View style={styles.permanentNote}>
				<Icon name="info-circle" size="xxs" />
				<StyledText type="body" size="s" style={[styles.mutedText, styles.permanentNoteText]}>
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
	identityRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.m
	},
	iconCircle: {
		width: ICON_CIRCLE_SIZE,
		height: ICON_CIRCLE_SIZE,
		borderRadius: Sizes.Semantic.borderRadius.round,
		backgroundColor: Colors.Semantic.background.tertiary.lighter,
		justifyContent: 'center',
		alignItems: 'center'
	},
	nameColumn: {
		flex: 1
	},
	mosaicId: {
		color: Colors.Semantic.content.primary.muted
	},
	amountColumn: {
		alignItems: 'flex-end'
	},
	amountRow: {
		flexDirection: 'row',
		alignItems: 'baseline'
	},
	amountCapacity: {
		color: Colors.Semantic.role.secondary.weaker
	},
	detailRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	fractionRow: {
		flexDirection: 'row',
		alignItems: 'baseline',
		gap: Sizes.Semantic.spacing.s
	},
	mutedText: {
		color: Colors.Semantic.content.primary.muted
	},
	permanentNote: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.s
	},
	permanentNoteText: {
		flex: 1
	}
});
