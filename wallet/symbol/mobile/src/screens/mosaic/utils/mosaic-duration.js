import { formatNumberGroups } from './mosaic-display';
import { $t } from '@/app/localization';
import { MOSAIC_DURATION_MAX, MOSAIC_DURATION_MIN, SECONDS_PER_YEAR } from '@/app/screens/mosaic/constants';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').DurationUnit} DurationUnit */

/**
 * Parses the duration form value into a number of blocks, keeping the empty state distinct
 * from zero (an empty string must never be read as the on-chain "never expires" sentinel).
 * @param {string} duration - The duration form value in blocks.
 * @returns {number|null} The duration in blocks, or null when the value is empty or not numeric.
 */
export const parseDurationBlocks = duration => {
	if (duration === '' || duration === null || duration === undefined)
		return null;

	const blocks = Number(duration);

	return Number.isFinite(blocks) ? blocks : null;
};

/**
 * Clamps a number to an inclusive range.
 * @param {number} value - The value to clamp.
 * @param {number} min - The lower bound.
 * @param {number} max - The upper bound.
 * @returns {number} The clamped value.
 */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Rounds a block amount and clamps it to the valid mosaic duration range.
 * @param {number} blocks - The block amount to clamp.
 * @returns {number} The rounded, clamped block amount.
 */
const clampDurationBlocks = blocks => clamp(Math.round(blocks), MOSAIC_DURATION_MIN, MOSAIC_DURATION_MAX);

/**
 * Converts a unit amount to a block count.
 * @param {number} count - The amount of units.
 * @param {DurationUnit} unit - The duration unit.
 * @param {string|number} blockGenerationTargetTime - The network block time in seconds.
 * @returns {number} The duration in blocks.
 */
export const unitCountToBlocks = (count, unit, blockGenerationTargetTime) => {
	const blockTime = Number(blockGenerationTargetTime);

	return Math.round((count * unit.seconds) / blockTime);
};

/**
 * Converts a block amount to a fractional unit count.
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
 * Snaps a block amount to the nearest whole count of a unit, clamped to that unit's range, and
 * returns the equivalent duration in blocks as a string. A null block amount snaps to one unit.
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
 * Returns the localized block count text with thousand-group spacing and the unit word
 * (e.g. "1 051 200 blocks").
 * @param {number} blocks - The duration in blocks.
 * @returns {string} The block count text.
 */
export const getBlockCountText = blocks => $t('s_mosaicCreation_durationAmount_blocks', {
	count: blocks,
	value: formatNumberGroups(blocks)
});

/**
 * Returns the default duration: one year expressed in blocks, or an empty string when the block
 * time is unknown.
 * @param {string|number} blockGenerationTargetTime - The network block time in seconds.
 * @returns {string} The default duration in blocks, or an empty string.
 */
export const getDefaultDurationInputValue = blockGenerationTargetTime => {
	const blockTime = Number(blockGenerationTargetTime);

	if (!blockTime)
		return '';

	return String(clampDurationBlocks(SECONDS_PER_YEAR / blockTime));
};
