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
 * Converts a computed block amount into the canonical duration form value: a rounded integer clamped
 * to the allowed network range, as a plain digit string. An unknown amount, such as null or non-finite
 * when the block time is not loaded yet, yields the empty form value.
 * @param {number|null} blocks - The computed duration in blocks.
 * @returns {string} The canonical duration form value.
 */
export const toDurationFormValue = blocks => {
	if (blocks === null || !Number.isFinite(blocks))
		return '';

	const clampedBlocks = Math.min(Math.max(Math.round(blocks), MOSAIC_DURATION_MIN), MOSAIC_DURATION_MAX);

	return String(clampedBlocks);
};

/**
 * Converts a human unit amount to blocks, without clamping (callers detect capping explicitly).
 * @param {number} count - The amount of units.
 * @param {DurationUnit} unit - The duration unit.
 * @param {string|number} blockGenerationTargetTime - The network block time in seconds.
 * @returns {number|null} The duration in blocks, or null when the block time is unknown.
 */
export const unitCountToBlocks = (count, unit, blockGenerationTargetTime) => {
	const blockTime = Number(blockGenerationTargetTime);

	if (!blockTime)
		return null;

	return Math.round((count * unit.seconds) / blockTime);
};

/**
 * Converts a block amount to a fractional human unit count (display only).
 * @param {number} blocks - The duration in blocks.
 * @param {DurationUnit} unit - The duration unit.
 * @param {string|number} blockGenerationTargetTime - The network block time in seconds.
 * @returns {number|null} The unit count, or null when the block time is unknown.
 */
export const blocksToUnitCount = (blocks, unit, blockGenerationTargetTime) => {
	const blockTime = Number(blockGenerationTargetTime);

	if (!blockTime)
		return null;

	return (blocks * blockTime) / unit.seconds;
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
 * Returns the duration pre-filled when the token is first marked as expiring: one year, so the
 * token never starts life in the sub-day danger range.
 * @param {string|number} blockGenerationTargetTime - The network block time in seconds.
 * @returns {string} The prefilled duration form value, or an empty string when the block time is unknown.
 */
export const getExpiryPrefillDuration = blockGenerationTargetTime => {
	const blockTime = Number(blockGenerationTargetTime);

	return blockTime ? toDurationFormValue(SECONDS_PER_YEAR / blockTime) : '';
};
