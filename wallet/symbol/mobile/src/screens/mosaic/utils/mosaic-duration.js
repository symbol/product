import { formatNumberGroups } from './number-format';
import { $t } from '@/app/localization';
import { MOSAIC_DURATION_MAX, MOSAIC_DURATION_MIN, SECONDS_PER_YEAR } from '@/app/screens/mosaic/constants';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').DurationUnit} DurationUnit */

/**
 * Parses the duration form value into a block count, treating empty as null so it stays distinct from
 * zero (zero means the mosaic never expires).
 * @param {string} duration - The duration form value in blocks.
 * @returns {number|null} The block count, or null when the value is empty or non-numeric.
 * @example
 * parseDurationBlocks('1000'); // 1000
 * parseDurationBlocks('');     // null
 */
export const parseDurationBlocks = duration => {
	if (duration === '' || duration === null || duration === undefined)
		return null;

	const blocks = Number(duration);

	return Number.isFinite(blocks) ? blocks : null;
};

/**
 * Clamps a value to an inclusive range.
 * @param {number} value - The value to clamp.
 * @param {number} min - The lower bound.
 * @param {number} max - The upper bound.
 * @returns {number} The clamped value.
 */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Rounds a block amount to a whole number and clamps it to the valid duration range.
 * @param {number} blocks - The block amount.
 * @returns {number} The rounded, clamped block amount.
 */
const clampDurationBlocks = blocks => clamp(Math.round(blocks), MOSAIC_DURATION_MIN, MOSAIC_DURATION_MAX);

/**
 * Converts a whole count of a duration unit into a block count, using the network block time to bridge
 * seconds and blocks.
 * @param {number} count - The number of units.
 * @param {DurationUnit} unit - The duration unit.
 * @param {string|number} blockGenerationTargetTime - The network block time in seconds.
 * @returns {number} The duration in blocks.
 */
export const unitCountToBlocks = (count, unit, blockGenerationTargetTime) => {
	const blockTime = Number(blockGenerationTargetTime);

	return Math.round((count * unit.seconds) / blockTime);
};

/**
 * Converts a block count into the nearest whole count of a duration unit, using the network block time
 * to bridge blocks and seconds.
 * @param {number} blocks - The duration in blocks.
 * @param {DurationUnit} unit - The duration unit.
 * @param {string|number} blockGenerationTargetTime - The network block time in seconds.
 * @returns {number} The unit count.
 */
export const blocksToUnitCount = (blocks, unit, blockGenerationTargetTime) => {
	const blockTime = Number(blockGenerationTargetTime);

	return Math.round((blocks * blockTime) / unit.seconds);
};

/**
 * Snaps a block count to the nearest whole count of a unit and returns the equivalent blocks as a string,
 * bounded to that unit's range, so the value lands on a selectable whole amount. An empty value snaps to
 * one unit.
 * @param {number|null} blocks - The current duration in blocks, or null when empty.
 * @param {DurationUnit} unit - The target duration unit.
 * @param {string|number} blockGenerationTargetTime - The network block time in seconds.
 * @returns {string} The snapped duration in blocks.
 */
export const snapBlocksToUnitNearestValue = (blocks, unit, blockGenerationTargetTime) => {
	const rawCount = blocks === null ? 1 : blocksToUnitCount(blocks, unit, blockGenerationTargetTime);
	const count = clamp(rawCount, 1, unit.maxCount);
	const snappedBlocks = unitCountToBlocks(count, unit, blockGenerationTargetTime);

	return String(clampDurationBlocks(snappedBlocks));
};

/**
 * Returns the localized block-count text with thousand-grouped digits (e.g. "1 051 200 blocks").
 * @param {number} blocks - The duration in blocks.
 * @returns {string} The block count text.
 */
export const getBlockCountText = blocks => $t('s_mosaicCreation_durationAmount_blocks', {
	count: blocks,
	value: formatNumberGroups(blocks)
});

/**
 * Returns the default duration of one year expressed in blocks, or an empty string when the network block
 * time is not yet known.
 * @param {string|number} blockGenerationTargetTime - The network block time in seconds.
 * @returns {string} The default duration in blocks, or an empty string.
 */
export const getDefaultDurationInputValue = blockGenerationTargetTime => {
	const blockTime = Number(blockGenerationTargetTime);

	if (!blockTime)
		return '';

	return String(clampDurationBlocks(SECONDS_PER_YEAR / blockTime));
};
