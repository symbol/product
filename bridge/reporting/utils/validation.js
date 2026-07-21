const TRANSACTION_HASH_PATTERN = /^(?:0x)?[0-9a-fA-F]{64}$/;
const ETHEREUM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const SYMBOL_ADDRESS_PATTERN = /^[A-Z2-7]{39}$/;

/**
 * A normalized search value and its detected type.
 * @typedef {Object} ParsedSearchInput
 * @property {'address'|'hash'|null} type Detected search type, or `null` for an empty input.
 * @property {string} value Normalized search value.
 */

/**
 * Parses and normalizes a Symbol address, Ethereum address, or transaction hash.
 * @param {string} [input=''] Search input.
 * @returns {ParsedSearchInput|null} Parsed input, or `null` when the input is invalid.
 */
export const parseSearchInput = input => {
	const value = (input || '').trim();

	if (!value)
		return { type: null, value: '' };

	if (TRANSACTION_HASH_PATTERN.test(value))
		return { type: 'hash', value: value.replace(/^0x/i, '').toUpperCase() };

	if (ETHEREUM_ADDRESS_PATTERN.test(value))
		return { type: 'address', value };

	const normalizedAddress = value.replace(/-/g, '').toUpperCase();
	if (SYMBOL_ADDRESS_PATTERN.test(normalizedAddress))
		return { type: 'address', value: normalizedAddress };

	return null;
};
