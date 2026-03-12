/**
 * Returns the amount in network currency text.
 * @param {number} amount - Mosaic amount.
 * @param {import('../types/Price').Price} price - The price object.
 * @param {string} networkIdentifier - Network identifier.
 * @returns {string} The network currency amount text.
 */
export const getUserCurrencyAmountText = (amount, price, networkIdentifier) => {
	if (networkIdentifier !== 'mainnet' || !price) 
		return '';

	if (!amount)
		return `0.00 ${price.currency}`;

	return `~${(price.value * amount).toFixed(2)} ${price.currency}`;
};

/**
 * Truncate amount string to the specified divisibility without rounding
 * @param {string} amount - The amount string (e.g. "123.456789")
 * @param {number} divisibility - The number of decimal places to keep
 * @returns {string} The truncated amount string
 */
export const formatAmountInput = (amount, divisibility) => {
	if (!amount)
		return '0';

	let [intPart, decPart] = amount.split('.');

	// Remove leading zeros, but keep at least "0"
	intPart = intPart.replace(/^0+(?!$)/, '');

	if (!decPart) 
		return intPart;

	// Truncate decimals
	const truncated = decPart.slice(0, divisibility);

	// Remove trailing zeros if divisibility > 0 and decimal part becomes empty
	return divisibility > 0 && truncated
		? `${intPart}.${truncated}`
		: intPart;
};

/**
 * Formats a date string to a readable format.
 * @param {string} dateStr - The date string.
 * @param {Function} translate - The translation function.
 * @param {boolean} [showTime] - Whether to show the time.
 * @returns {string} The formatted date string.
 */
export const formatDate = (dateStr, translate, showTime = false) => {
	const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

	const addZero = num => {
		return 0 <= num && 10 > num ? '0' + num : num + '';
	};

	const dateObj = new Date(dateStr);
	const minutes = addZero(dateObj.getMinutes());
	const hour = addZero(dateObj.getHours());
	const month = 'function' === typeof translate ? translate('month_' + months[dateObj.getMonth()]) : months[dateObj.getMonth()];
	const day = dateObj.getDate();
	const year = dateObj.getFullYear();

	let formattedDate = `${month} ${day}, ${year}`;
	formattedDate += showTime ? ` ${hour}:${minutes}` : '';

	return formattedDate;
};
