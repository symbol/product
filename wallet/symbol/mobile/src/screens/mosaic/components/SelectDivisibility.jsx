import { StyledText, TabSelector } from '@/app/components';
import { $t } from '@/app/localization';
import { MOSAIC_DIVISIBILITY_MAX, MOSAIC_DIVISIBILITY_MIN } from '@/app/screens/mosaic/constants';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Tab items for the divisibility (decimal places) selector.
 * @type {Array<{value: string, label: string}>}
 */
const DIVISIBILITY_TAB_ITEMS = Array.from(
	{ length: MOSAIC_DIVISIBILITY_MAX - MOSAIC_DIVISIBILITY_MIN + 1 },
	(_, index) => ({
		value: String(MOSAIC_DIVISIBILITY_MIN + index),
		label: String(MOSAIC_DIVISIBILITY_MIN + index)
	})
);

/**
 * Returns the live hint describing the selected number of decimal places.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {string} The decimals hint text.
 */
const getDecimalsHintText = divisibility => {
	if (divisibility === 0)
		return $t('s_mosaicCreation_decimalsHint_whole');

	return $t('s_mosaicCreation_decimalsHint', { count: divisibility });
};

/**
 * SelectDivisibility component. The mosaic divisibility (decimal places) selector: a labelled tab
 * row offering every allowed value, with a live hint describing the current selection.
 * @param {object} props - Component props.
 * @param {string} props.value - The current divisibility input value.
 * @param {function(string): void} props.onChange - Callback fired with the new divisibility value.
 * @returns {React.ReactNode} SelectDivisibility component.
 */
export const SelectDivisibility = ({ value, onChange }) => (
	<View style={styles.root}>
		<View style={styles.labelRow}>
			<StyledText type="label" size="s" style={styles.mutedText}>
				{$t('s_mosaicCreation_decimalPlaces_label')}
			</StyledText>
			<StyledText type="label" size="s" style={styles.decimalsHint}>
				{getDecimalsHintText(Number(value))}
			</StyledText>
		</View>
		<TabSelector
			list={DIVISIBILITY_TAB_ITEMS}
			value={value}
			onChange={onChange}
		/>
	</View>
);

const styles = StyleSheet.create({
	root: {
		gap: Sizes.Semantic.spacing.s
	},
	labelRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	decimalsHint: {
		color: Colors.Semantic.role.secondary.default
	},
	mutedText: {
		color: Colors.Semantic.content.primary.muted
	}
});
