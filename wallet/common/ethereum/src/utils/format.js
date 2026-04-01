/**
 * Ensures a hex string follows the '0x' lowercase convention.
 * @param {string} hex - The hex string.
 * @returns {string} The lowercase hex string prefixed with '0x'.
 */
export const to0x = hex => {
	const lowercaseHex = hex.toLowerCase();

	if (lowercaseHex.startsWith('0x'))
		return lowercaseHex;

	return `0x${lowercaseHex}`;
};
