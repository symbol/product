const ZERO = '0'.charCodeAt(0);
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Convert an absolute token amount (integer-like) to a relative amount (decimal-like).
 * Examples:
 *  - absoluteToRelativeAmount("123456", 6) -> "0.123456"
 *  - absoluteToRelativeAmount("1000", 3)   -> "1"
 *
 * @param {string|number} absoluteAmount - The token absolute amount (can be a numeric string).
 * @param {number} divisibility - Number of fractional digits the token supports (>= 0).
 * @returns {string} The token relative amount.
 */
export const absoluteToRelativeAmount = (absoluteAmount, divisibility) => {
	if (divisibility < 0)
		throw new Error('Divisibility must be a non-negative integer');

	const absoluteString = trimLeadingZeros(String(absoluteAmount));

	if (divisibility === 0)
		return absoluteString;

	// Ensure there are at least (divisibility + 1) digits to safely split integer/fractional parts
	const padded = absoluteString.padStart(divisibility + 1, '0');

	// Everything before the last "divisibility" digits is the integer part
	const integerPart = padded.slice(0, -divisibility);

	// Last "divisibility" digits are the fractional part
	const fractionalPartRaw = padded.slice(-divisibility);

	// Remove insignificant trailing zeros from the fractional part
	const fractionalPart = trimTrailingZeros(fractionalPartRaw);

	return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
};

/**
 * Convert a relative token amount (decimal-like) to an absolute amount (integer-like).
 * Examples:
 *  - relativeToAbsoluteAmount("0.123456", 6) -> "123456"
 *  - relativeToAbsoluteAmount("1", 3)        -> "1000"
 *
 * @param {string|number} relativeAmount - The token relative amount (can be a numeric string).
 * @param {number} divisibility - Number of fractional digits the token supports (>= 0).
 * @returns {string} The token absolute amount.
 */
export const relativeToAbsoluteAmount = (relativeAmount, divisibility) => {
	if (divisibility < 0)
		throw new Error('Divisibility must be a non-negative integer');

	const [integerPartRaw, fractionalPartRaw = ''] = String(relativeAmount).split('.');

	// Normalize missing integer part like ".5" -> "0.5"
	const integerPart = integerPartRaw || '0';

	// Truncate extra fractional digits, then right-pad to exactly match divisibility
	const fractionalPart = fractionalPartRaw.slice(0, divisibility).padEnd(divisibility, '0');

	// Concatenate and remove leading zeros; helper returns "0" for all-zero
	const absoluteString = integerPart + fractionalPart;
	return trimLeadingZeros(absoluteString);
};

/**
 * @callback SafeOperationCallback
 * @param {...BigInt} args - The absolute amounts as BigInt.
 * @returns {BigInt} The result of the operation.
 */

/**
 * Safely performs an operation with relative amounts by converting them to absolute amounts.
 * @param {number} divisibility - The divisibility of the token.
 * @param {Array<string|number>} values - The relative amounts to operate on.
 * @param {SafeOperationCallback} callback - The operation to perform.
 * @returns {string} The result of the operation as a relative amount.
 */
export const safeOperationWithRelativeAmounts = (divisibility, values, callback) => {
	const absoluteAmounts = values.map(value => relativeToAbsoluteAmount(value, divisibility));
	const bigIntAmounts = absoluteAmounts.map(amount => BigInt(amount));

	const result = callback(...bigIntAmounts);
	const relativeResult = absoluteToRelativeAmount(result, divisibility);

	return relativeResult;
};

const trimLeadingZeros = s => {
	let i = 0;

	while (i < s.length && s.charCodeAt(i) === ZERO) 
		i++;

	return i === s.length ? '0' : s.slice(i);
};

const trimTrailingZeros = s => {
	let i = s.length - 1;

	while (i >= 0 && s.charCodeAt(i) === ZERO) 
		i--;

	return s.slice(0, i + 1);
};

/**
 * Converts a hexadecimal string to a Base32 string.
 * @param {string} hexString - The hexadecimal string to convert.
 * @returns {string} The Base32 representation of the hexadecimal string.
 */
export const hexToBase32 = hexString => {
	// Convert hex to binary string
	let binaryString = '';
	hexString.split('').forEach(hexCharacter => {
		const binaryChunk = parseInt(hexCharacter, 16).toString(2).padStart(4, '0');
		binaryString += binaryChunk;
	});

	// Group binary string into 5-bit chunks
	const base32Characters = [];
	for (let bitIndex = 0; bitIndex < binaryString.length; bitIndex += 5) {
		const binaryChunk = binaryString.slice(bitIndex, bitIndex + 5);
		if (binaryChunk.length < 5) {
			// pad last chunk
			const paddedChunk = binaryChunk.padEnd(5, '0');
			const base32Character = BASE32_ALPHABET[parseInt(paddedChunk, 2)];
			base32Characters.push(base32Character);
		} else {
			const base32Character = BASE32_ALPHABET[parseInt(binaryChunk, 2)];
			base32Characters.push(base32Character);
		}
	}

	return base32Characters.join('');
};

/**
 * Converts a Base32 string to a hexadecimal string.
 * @param {string} base32String - The Base32 string to convert.
 * @returns {string} The hexadecimal representation of the Base32 string.
 */
export const base32ToHex = base32String => {
	// Convert base32 to binary string
	let binaryString = '';
	base32String.split('').forEach(base32Character => {
		const characterIndex = BASE32_ALPHABET.indexOf(base32Character.toUpperCase());
		const binaryChunk = characterIndex.toString(2).padStart(5, '0');
		binaryString += binaryChunk;
	});

	// Group binary string into 4-bit chunks
	const hexCharacters = [];
	for (let bitIndex = 0; bitIndex < binaryString.length; bitIndex += 4) {
		const binaryChunk = binaryString.slice(bitIndex, bitIndex + 4);
		if (binaryChunk.length === 4) {
			const hexCharacter = parseInt(binaryChunk, 2).toString(16).toUpperCase();
			hexCharacters.push(hexCharacter);
		}
	}

	// Trim a trailing padding nibble if present (case: base32 length % 4 === 0 adds 4 zero bits)
	if (
		base32String.length % 4 === 0 &&
		hexCharacters.length % 2 === 1 &&
		hexCharacters[hexCharacters.length - 1] === '0'
	) 
		hexCharacters.pop();
	

	return hexCharacters.join('');
};
