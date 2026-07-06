import { Dropdown, StyledText, TextBox, TouchableNative } from '@/app/components';
import { $t } from '@/app/localization';
import {
	MOSAIC_DURATION_MAX,
	MOSAIC_DURATION_MIN,
	SECONDS_PER_DAY,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
	SECONDS_PER_MONTH,
	SECONDS_PER_YEAR
} from '@/app/screens/mosaic/constants';
import {
	blocksToUnitCount,
	getBlockCountText,
	parseDurationBlocks,
	toDurationFormValue,
	unitCountToBlocks
} from '@/app/screens/mosaic/utils';
import { Colors, Sizes, Typography } from '@/app/styles';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').DurationUnit} DurationUnit */

// The "blocks" chip selects raw on-chain entry (a text box); every other chip selects a human unit
// whose whole-number counts are offered through a dropdown. Counts run up to one of the next unit
// (60 minutes, 24 hours, 30 days, 12 months) and cap at the 10 year network maximum.
const BLOCKS_UNIT_KEY = 'blocks';
const DURATION_UNITS = [
	{
		key: 'minutes',
		labelKey: 's_mosaicCreation_durationUnit_minutes',
		amountKey: 's_mosaicCreation_durationAmount_minutes',
		seconds: SECONDS_PER_MINUTE,
		maxCount: 60
	},
	{
		key: 'hours',
		labelKey: 's_mosaicCreation_durationUnit_hours',
		amountKey: 's_mosaicCreation_durationAmount_hours',
		seconds: SECONDS_PER_HOUR,
		maxCount: 24
	},
	{
		key: 'days',
		labelKey: 's_mosaicCreation_durationUnit_days',
		amountKey: 's_mosaicCreation_durationAmount_days',
		seconds: SECONDS_PER_DAY,
		maxCount: 30
	},
	{
		key: 'months',
		labelKey: 's_mosaicCreation_durationUnit_months',
		amountKey: 's_mosaicCreation_durationAmount_months',
		seconds: SECONDS_PER_MONTH,
		maxCount: 12
	},
	{
		key: 'years',
		labelKey: 's_mosaicCreation_durationUnit_years',
		amountKey: 's_mosaicCreation_durationAmount_years',
		seconds: SECONDS_PER_YEAR,
		maxCount: 10
	}
];
const UNIT_CHIP_KEYS = [BLOCKS_UNIT_KEY, ...DURATION_UNITS.map(unit => unit.key)];
const CHIP_HEIGHT = Sizes.Semantic.controlHeight.s;

/**
 * Returns the localized chip label for a unit key. The "blocks" chip has its own label,
 * every other chip reuses the human unit label.
 * @param {string} key - The unit key.
 * @returns {string} The chip label text.
 */
const getUnitChipLabel = key => key === BLOCKS_UNIT_KEY
	? $t('s_mosaicCreation_durationUnit_blocksChip')
	: $t(DURATION_UNITS.find(unit => unit.key === key).labelKey);

/**
 * Returns the unit amount text with the correct plural form (e.g. "1 month", "6 months").
 * @param {number} count - The amount of units.
 * @param {DurationUnit} unit - The duration unit.
 * @returns {string} The unit amount text.
 */
const getUnitAmountText = (count, unit) => $t(unit.amountKey, { count });

/**
 * Builds the whole-number count options for a human unit, expressed as block counts. Counts whose
 * derived block total falls outside the allowed range are dropped so every option is selectable.
 * @param {DurationUnit} unit - The duration unit descriptor.
 * @param {string|number} blockGenerationTargetTime - The network block time in seconds.
 * @returns {Array<{value: string, label: string, consequence: string}>} The dropdown options.
 */
const buildUnitOptions = (unit, blockGenerationTargetTime) => {
	const options = [];
	for (let count = 1; count <= unit.maxCount; count++) {
		const blocks = unitCountToBlocks(count, unit, blockGenerationTargetTime);
		if (blocks === null || blocks < MOSAIC_DURATION_MIN || blocks > MOSAIC_DURATION_MAX)
			continue;

		options.push({
			value: String(blocks),
			label: getUnitAmountText(count, unit),
			consequence: getBlockCountText(blocks)
		});
	}

	return options;
};

/**
 * A single selectable pill chip for a duration unit.
 * @param {object} props - Component props.
 * @param {string} props.label - The chip text.
 * @param {boolean} props.isActive - Whether the chip is selected.
 * @param {function(): void} props.onPress - Callback fired on chip press.
 * @returns {React.ReactNode} UnitChip component.
 */
const UnitChip = ({ label, isActive, onPress }) => {
	const colors = isActive ? Colors.Components.chip.active : Colors.Components.chip.default;

	return (
		<TouchableNative
			containerStyle={styles.chip}
			style={styles.chipContent}
			color={colors.background}
			colorPressed={Colors.Components.chip.pressed.background}
			onPress={onPress}
		>
			<Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
		</TouchableNative>
	);
};

/**
 * The horizontal, scrollable row of unit chips (blocks · minutes · … · years).
 * @param {object} props - Component props.
 * @param {string} props.activeUnitKey - The key of the currently selected unit.
 * @param {function(string): void} props.onSelect - Callback fired with the picked unit key.
 * @returns {React.ReactNode} UnitChipRow component.
 */
const UnitChipRow = ({ activeUnitKey, onSelect }) => (
	<FlatList
		horizontal
		showsHorizontalScrollIndicator={false}
		data={UNIT_CHIP_KEYS}
		keyExtractor={key => key}
		contentContainerStyle={styles.chips}
		renderItem={({ item: key }) => (
			<UnitChip
				label={getUnitChipLabel(key)}
				isActive={key === activeUnitKey}
				onPress={() => onSelect(key)}
			/>
		)}
	/>
);

/**
 * A single dropdown row: the human amount with its exact block count underneath.
 * @param {object} props - Component props.
 * @param {{label: string, consequence: string}} props.option - The unit option to render.
 * @returns {React.ReactNode} DurationOptionRow component.
 */
const DurationOptionRow = ({ option }) => (
	<View style={styles.dropdownItem}>
		<StyledText type="body">
			{option.label}
		</StyledText>
		<StyledText type="body" size="s" style={styles.mutedText}>
			{option.consequence}
		</StyledText>
	</View>
);

/**
 * The value entry field. The "blocks" unit shows a raw block text box; every other
 * unit shows a dropdown of whole-number counts for that unit.
 * @param {object} props - Component props.
 * @param {string} props.unitKey - The key of the currently selected unit.
 * @param {DurationUnit} [props.unit] - The selected human unit descriptor (absent for the "blocks" unit).
 * @param {string} props.duration - The duration form value in blocks.
 * @param {string|number} [props.blockGenerationTargetTime] - The network block time in seconds.
 * @param {string} [props.errorMessage] - Validation error shown under the blocks text box.
 * @param {function(string): void} props.onDurationChange - Callback fired with the new duration value.
 * @returns {React.ReactNode} DurationValueField component.
 */
const DurationValueField = ({ unitKey, unit, duration, blockGenerationTargetTime, errorMessage, onDurationChange }) => {
	if (unitKey === BLOCKS_UNIT_KEY) {
		return (
			<TextBox
				label={$t('s_mosaicCreation_duration_blocksInputLabel')}
				keyboardType="number-pad"
				placeholder={String(MOSAIC_DURATION_MIN)}
				value={duration}
				errorMessage={errorMessage}
				onChange={onDurationChange}
			/>
		);
	}

	const options = buildUnitOptions(unit, blockGenerationTargetTime);
	const selectedOption = options.find(option => option.value === duration);

	return (
		<Dropdown
			label={$t(unit.labelKey)}
			value={selectedOption ? selectedOption.value : ''}
			list={options}
			isDisabled={!options.length}
			renderItem={({ item }) => <DurationOptionRow option={item} />}
			onChange={onDurationChange}
		/>
	);
};

/**
 * InputDuration component. A unit chip row (blocks · minutes · hours · days · months ·
 * years) paired with a value control: the "blocks" chip reveals a raw block text box, every other
 * chip reveals a dropdown of whole-number counts for that unit. Switching to a human unit snaps the
 * current value to the nearest whole count so the dropdown always reflects it.
 * @param {object} props - Component props.
 * @param {string} props.duration - The duration form value in blocks.
 * @param {string|number} [props.blockGenerationTargetTime] - The network block time in seconds.
 * @param {string} [props.errorMessage] - Validation error for the duration (required and range).
 * @param {function(string): void} props.onDurationChange - Callback fired with the new duration value.
 * @returns {React.ReactNode} InputDuration component.
 */
export const InputDuration = ({ duration, blockGenerationTargetTime, errorMessage, onDurationChange }) => {
	const [unitKey, setUnitKey] = useState(BLOCKS_UNIT_KEY);
	const blocks = parseDurationBlocks(duration);
	const selectedUnit = DURATION_UNITS.find(unit => unit.key === unitKey);

	const handleUnitSelect = nextUnitKey => {
		setUnitKey(nextUnitKey);
		if (nextUnitKey === BLOCKS_UNIT_KEY)
			return;

		// Without the block time the unit options cannot be built, so the current value is left untouched.
		if (!Number(blockGenerationTargetTime))
			return;

		// Snap the current value to the nearest whole count of the chosen unit so the dropdown
		// always has a matching option; an empty or invalid value snaps to a single unit.
		const nextUnit = DURATION_UNITS.find(unit => unit.key === nextUnitKey);
		const rawCount = blocks === null ? 1 : blocksToUnitCount(blocks, nextUnit, blockGenerationTargetTime);
		const count = Math.min(Math.max(Math.round(rawCount), 1), nextUnit.maxCount);
		onDurationChange(toDurationFormValue(unitCountToBlocks(count, nextUnit, blockGenerationTargetTime)));
	};

	return (
		<View style={styles.root}>
			<UnitChipRow activeUnitKey={unitKey} onSelect={handleUnitSelect} />
			<DurationValueField
				unitKey={unitKey}
				unit={selectedUnit}
				duration={duration}
				blockGenerationTargetTime={blockGenerationTargetTime}
				errorMessage={errorMessage}
				onDurationChange={onDurationChange}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		gap: Sizes.Semantic.spacing.l
	},
	chips: {
		gap: Sizes.Semantic.spacing.s
	},
	chip: {
		height: CHIP_HEIGHT,
		borderRadius: Sizes.Semantic.borderRadius.round,
		overflow: 'hidden'
	},
	chipContent: {
		height: '100%',
		justifyContent: 'center',
		paddingHorizontal: Sizes.Semantic.spacing.l
	},
	chipText: {
		...Typography.Semantic.label.m
	},
	dropdownItem: {
		flex: 1,
		gap: Sizes.Semantic.spacing.xs,
		paddingVertical: Sizes.Semantic.spacing.xs
	},
	mutedText: {
		color: Colors.Semantic.content.primary.muted
	}
});
