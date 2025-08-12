/**
 * Safely decodes a JSON string.
 * @param {string | null} json The JSON string to decode.
 * @returns {object | Array | null} The decoded object, or null if decoding fails.
 */
export const decodeJson = json => {
	if (json === null)
		return null;

	return JSON.parse(json);
};

/**
 * Encodes a nullable string value by converting null to the string 'null'.
 * @param {string | null} value The value to encode.
 * @returns {string} The encoded string. Returns 'null' if the input is null, otherwise returns the original value.
 */
export const encodeNullableString = value => {
	return value === null ? 'null' : value;
};

/**
 * Decodes a nullable string value by converting the string 'null' back to null.
 * @param {string | null} value The value to decode.
 * @returns {string | null} The decoded value. Returns null if the input is 'null', otherwise returns the original value.
 */
export const decodeNullableString = value => {
	return value === 'null' ? null : value;
};
