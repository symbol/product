/** @typedef {import('../types/Logger').Logger} Logger */

/**
 * Logger utility to create a logger instance.
 * @param {Logger} [logger] - An optional logger object to use instead of the default console logger.
 * @returns {Logger} - The logger instance.
 */
export const createLogger = logger => {
	return logger || console;
};
