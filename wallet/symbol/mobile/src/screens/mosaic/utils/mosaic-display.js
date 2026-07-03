const SECONDS_PER_DAY = 86400;

/**
 * Calculates the approximate mosaic rental duration in days from a duration in blocks.
 * @param {string|number} duration - The duration in blocks.
 * @param {string|number} blockGenerationTargetTime - The network target block generation time in seconds.
 * @returns {number} The approximate duration in days.
 */
export const calculateMosaicDurationDays = (duration, blockGenerationTargetTime) =>
	Math.round((Number(duration) * Number(blockGenerationTargetTime)) / SECONDS_PER_DAY);
