import { config } from '@/_variants/symbol/config';

/**
 * Converts a timestamp to a formatted timestamp. Adjusts the timestamp by the configured epoch adjustment.
 * @param {number} timestamp - The timestamp to format.
 * @returns {number} The formatted timestamp.
 */
export const formatTimestamp = (timestamp) => Number(timestamp) + (config.SYMBOL_EPOCH_ADJUSTMENT * 1000);
