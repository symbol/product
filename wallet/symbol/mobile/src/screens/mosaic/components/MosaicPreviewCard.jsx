import { Card, Divider, Icon, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { createSupplyDisplayData, getSmallestFractionText } from '@/app/screens/mosaic/utils';
import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const ICON_CIRCLE_SIZE = Sizes.Semantic.avatarHeight.l;

// Monospace digits slightly enlarged to the large body size for the amount preview.
const heroDigitTypography = {
	...Typography.Semantic.mnemonic.m,
	fontSize: Typography.Semantic.body.m.fontSize,
	lineHeight: Typography.Semantic.body.m.lineHeight
};

/**
 * Returns the smallest sendable amount text, spelled out for the indivisible case.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {string} The smallest sendable amount text.
 */
const getSmallestSendText = divisibility =>
	divisibility > 0 ? getSmallestFractionText(divisibility) : $t('s_mosaicCreation_smallestSend_whole');

/**
 * MosaicPreviewCard component. A read-only receipt of the mosaic being created: the identity row
 * (icon, name placeholder and derived mosaic id) beside the total supply rendered with the entered
 * amount in full and the unused decimal capacity dimmed, followed by the smallest sendable amount
 * and a note that the decimal places are permanent.
 * @param {object} props - Component props.
 * @param {string} props.supply - The mosaic supply input value in relative units.
 * @param {string} props.divisibility - The current divisibility input value.
 * @param {string} [props.mosaicId] - The derived mosaic id, when the creator is known.
 * @returns {React.ReactNode} MosaicPreviewCard component.
 */
export const MosaicPreviewCard = ({ supply, divisibility, mosaicId }) => {
	const divisibilityValue = Number(divisibility);
	const { integer, enteredFraction, paddingFraction } = createSupplyDisplayData(supply, divisibilityValue);

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
				<View style={styles.amountColumn}>
					<StyledText type="label" size="s" style={styles.mutedText}>
						{$t('s_mosaicCreation_totalSupply_label')}
					</StyledText>
					<View style={styles.amountRow}>
						<Text style={styles.amountInteger}>{integer}</Text>
						{divisibilityValue > 0 && (
							<Animated.View key={divisibilityValue} entering={FadeIn} style={styles.amountRow}>
								<Text style={enteredFraction ? styles.amountInteger : styles.amountDecimals}>.</Text>
								{!!enteredFraction && <Text style={styles.amountInteger}>{enteredFraction}</Text>}
								{!!paddingFraction && <Text style={styles.amountDecimals}>{paddingFraction}</Text>}
							</Animated.View>
						)}
					</View>
				</View>
			</View>
			<Divider />
			<View style={styles.detailRow}>
				<StyledText type="body" size="s" style={styles.mutedText}>
					{$t('s_mosaicCreation_smallestSend_label')}
				</StyledText>
				<Text style={styles.smallestSendText}>{getSmallestSendText(divisibilityValue)}</Text>
			</View>
			<View style={styles.permanentNote}>
				<Icon name="info-circle" size="xxs" />
				<StyledText type="body" size="s" style={styles.permanentNoteText}>
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
	amountInteger: {
		...heroDigitTypography,
		color: Colors.Semantic.content.primary.default
	},
	amountDecimals: {
		...heroDigitTypography,
		color: Colors.Semantic.role.secondary.weaker
	},
	detailRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	smallestSendText: {
		...Typography.Semantic.mnemonic.m,
		color: Colors.Semantic.content.primary.default
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
		flex: 1,
		color: Colors.Semantic.content.primary.muted
	}
});
