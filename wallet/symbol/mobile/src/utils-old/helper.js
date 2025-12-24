import { NetworkIdentifier } from '@/app/constants';
import moment from 'moment';


/**
 * Truncates a string.
 * @param {string} str - The string to be truncated.
 * @param {string} type - The truncation preset.
 * @param {number} [length] - The length of the truncated string if type = 'custom'.
 * @returns {string} The truncated string.
 */
export const trunc = (str, type, length = 5) => {
	const trunc = (text, cut, lengthFirst, lengthSecond) => {
		if (cut === 'start' && lengthFirst < text.length) 
			return '...' + text.substring(text.length - lengthFirst, text.length);
        
		if (cut === 'middle' && lengthFirst + lengthSecond < text.length) 
			return text.substring(0, lengthFirst) + '...' + text.substring(text.length - lengthSecond, text.length);
        
		if (cut === 'end' && lengthFirst < text.length) 
			return text.substring(0, lengthFirst) + '...';
        

		return text;
	};

	if (typeof str !== 'string') 
		return '';
    

	switch (type) {
	case 'address':
		return trunc(str, 'middle', 6, 3);
	case 'address-short':
		return trunc(str, 'start', 3);
	case 'address-long':
		return trunc(str, 'middle', 12, 12);
	case 'contact':
		return trunc(str, 'end', 18);
	case 'contact-short':
		return trunc(str, 'end', 12);
	case 'hash':
		return trunc(str, 'middle', 12, 12);
	case 'mosaicId':
		return trunc(str, 'middle', 6, 6);
	case 'namespaceName':
		return trunc(str, 'middle', 10, 10);
	default:
		return trunc(str, 'end', length);
	}
};


/**
 * Formats a number to a fixed number of digits.
 * @param {number} num - The number.
 * @param {number} digits - The number of digits.
 * @returns {number} The formatted number.
 */
export const toFixedNumber = (num, digits) => {
	const power = Math.pow(10, digits);

	return Math.round(num * power) / power;
};

/**
 * Formats a number to a fixed numeric string. Ensures correct decimal placement and zero-padding.
 * @param {number} num - The number.
 * @param {number} divisibility - The divisibility.
 * @returns {string} The formatted numeric string.
 */
export const toFixedNumericString = (num, divisibility) => {
	if (divisibility === 0) 
		return num.toString();

	const numString = num.toFixed(divisibility);
	return numString;
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


/**
 * Converts a duration to days left from now.
 * @param {number} duration - The duration in blocks left.
 * @param {number} blockGenerationTargetTime - The block generation time.
 * @returns {string} The days left.
 */
export const blockDurationToDaysLeft = (duration, blockGenerationTargetTime) => {
	const seconds = duration * blockGenerationTargetTime;
	return moment.utc().add(seconds, 's').fromNow();
};

/**
 * Returns the amount in network currency text.
 * @param {number} amount - Mosaic amount.
 * @param {object} price - The price object.
 * @param {number} price.value - The current price value.
 * @param {string} price.currency - The currency ticker.
 * @param {string} networkIdentifier - Network identifier.
 * @returns {string} The network currency amount text.
 */
export const getUserCurrencyAmountText = (amount, price, networkIdentifier) => {
	if (networkIdentifier !== NetworkIdentifier.MAIN_NET || !price) 
		return '';

	return `~${(price.value * amount).toFixed(2)} ${price.currency}`;
};

