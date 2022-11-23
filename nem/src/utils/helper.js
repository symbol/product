/**
 * Converts absolute amount to relative.
 * @param {number} value absolute amount.
 * @param {number} divisibility divisibility.
 * @returns {number} relative amount.
 */
export const absoluteToRelativeAmount = (value, divisibility) => value / 10 ** divisibility;

/**
 * Converts relative amount to absolute.
 * @param {number} value relative amount.
 * @param {number} divisibility divisibility.
 * @returns {number} absolute amount.
 */
export const relativeToAbsoluteAmount = (value, divisibility) => value * 10 ** divisibility;

/**
 * Validates NEM address
 * @param {string} address address string.
 * @returns {boolean} address validity.
 */
export const validateNEMAddress = address => {
	const formattedAddress = address.toUpperCase().replace(/-/g, '');

	if (!formattedAddress || 40 !== formattedAddress.length || 'T' !== formattedAddress[0])
		return false;

	return true;
};
