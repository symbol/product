import moment from 'moment';
import { Duration, Instant, LocalDateTime, ZoneId } from '@js-joda/core';
import { showMessage as rnFlashMessage } from 'react-native-flash-message';
import { $t } from '@/app/localization';
import { NetworkIdentifier } from '@/app/constants';

const CHARSET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Shows a flash message.
 * @param {object} options - The message options.
 * @param {string} options.message - The message.
 * @param {string} options.type - The message type.
 * @returns {void}
 */
export const showMessage = ({ message, type }) => rnFlashMessage({ message, type });

/**
 * Handles an error by showing a flash message and logging the error.
 * @param {Error} error - The error.
 * @returns {void}
 */
export const handleError = (error) => {
    const message = $t(error.message, { defaultValue: error.message });
    showMessage({ message, type: 'danger' });
    console.error(error);
};

/**
 * Truncates a string.
 * @param {string} str - The string to be truncated.
 * @param {string} type - The truncation preset.
 * @param {number} [length] - The length of the truncated string if type = 'custom'.
 * @returns {string} The truncated string.
 */
export const trunc = (str, type, length = 5) => {
    const trunc = (text, cut, lengthFirst, lengthSecond) => {
        if (cut === 'start' && lengthFirst < text.length) {
            return '...' + text.substring(text.length - lengthFirst, text.length);
        }
        if (cut === 'middle' && lengthFirst + lengthSecond < text.length) {
            return text.substring(0, lengthFirst) + '...' + text.substring(text.length - lengthSecond, text.length);
        }
        if (cut === 'end' && lengthFirst < text.length) {
            return text.substring(0, lengthFirst) + '...';
        }

        return text;
    };

    if (typeof str !== 'string') {
        return '';
    }

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
 * Calculates the percentage of a character in the charset.
 * @param {string} char - The character.
 * @returns {number} The percentage.
 */
export const getCharPercentage = (char) => {
    const index = CHARSET.indexOf(char.toLowerCase());

    return index / (CHARSET.length - 1);
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
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @returns {object} {R: Number, G: Number, B: Number}
 */
export const hslToRgb = (h, s, l) => {
    let r, g, b;

    const hue2rgb = (_p, _q, _t) => {
        if (0 > _t) _t += 1;
        if (1 < _t) _t -= 1;
        if (_t < 1 / 6) return _p + (_q - _p) * (6 * _t);
        if (_t < 1 / 2) return _q;
        if (_t < 2 / 3) return _p + (_q - _p) * ((2 / 3 - _t) * 6);
        return _p;
    };

    if (0 === s) {
        r = g = b = l; // achromatic
    } else {
        const q = 0.5 > l ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
        R: Math.round(r * 255),
        G: Math.round(g * 255),
        B: Math.round(b * 255),
    };
};

/**
 * Get RGB color from hash.
 * @param {string} hash - hash to be converted.
 * @param {boolean} isHex - default true
 * @returns {object} { R: Number, G: Number, B: Number }
 */
export const getColorFromHash = (hash) => {
    if (!hash) {
        return '#fff';
    }

    const spread = 100;
    const saturation = 0.9;
    const lightness = 0.8;

    let totalValue = 0;

    for (const char of hash) totalValue += CHARSET.indexOf(char.toLowerCase());

    const k = Math.trunc(totalValue / spread);
    const offsetValue = totalValue - spread * k;
    const hue = offsetValue / 100;

    const color = hslToRgb(hue, saturation, lightness);

    return `rgb(${color.R}, ${color.G}, ${color.B})`;
};

/**
 * Checks if an address is known. An address is known if it is in the address book or wallet accounts.
 * @param {string} address - The address.
 * @param {Array} accounts - Wallet accounts.
 * @param {object} addressBook - The address book.
 * @returns {boolean} True if the address is known, false otherwise.
 */
export const isAddressKnown = (address, accounts, addressBook) => {
    if (!address) {
        return false;
    }

    const walletAccount = accounts.find((account) => address === account.address);
    if (walletAccount) {
        return true;
    }

    const contact = addressBook.getContactByAddress(address);
    if (contact) {
        return true;
    }

    return false;
};

/**
 * Get the name of an address from the address book or wallet accounts.
 * @param {string} address - The address.
 * @param {object} currentAccount - The current account.
 * @param {Array} accounts - Wallet accounts.
 * @param {object} addressBook - The address book.
 * @returns {string} The name or an address if the name is not found.
 */
export const getAddressName = (address, currentAccount, accounts, addressBook) => {
    if (!address) {
        return '?';
    }

    if (address === currentAccount.address) {
        return currentAccount.name;
    }
    const walletAccount = accounts.find((account) => address === account.address);

    if (walletAccount) {
        return walletAccount.name;
    }

    const contact = addressBook.getContactByAddress(address);
    if (contact) {
        return contact.name;
    }

    return address;
};

/**
 * Converts a chain timestamp to a local date.
 * @param {number} timestamp - The chain timestamp.
 * @param {number} epochAdjustment - The epoch adjustment.
 * @returns {LocalDateTime} The local date.
 */
export const timestampToLocalDate = (timestamp, epochAdjustment) =>
    LocalDateTime.ofInstant(Instant.ofEpochMilli(timestamp).plusMillis(Duration.ofSeconds(epochAdjustment).toMillis()), ZoneId.SYSTEM);

/**
 * Formats a date string to a readable format.
 * @param {string} dateStr - The date string.
 * @param {Function} translate - The translation function.
 * @param {boolean} [showTime] - Whether to show the time.
 * @returns {string} The formatted date string.
 */
export const formatDate = (dateStr, translate, showTime = false) => {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    const addZero = (num) => {
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
 * Interleaves an array with values produced by a callback function.
 * Inserts the callback result between each element of the array.
 * @param {Array} arr - The array to be interleaved.
 * @param {Function} callback - The callback function.
 * @returns {Array} The interleaved array.
 */
export const interleave = (arr, callback) => arr.flatMap((el, index) => [el, callback(el, index)]).slice(0, -1);

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
    if (networkIdentifier !== NetworkIdentifier.MAIN_NET || !price) {
        return '';
    }

    return `~${(price.value * amount).toFixed(2)} ${price.currency}`;
};

/**
 * Returns a promise that resolves when all promises are settled.
 * Polyfill for Promise.allSettled.
 * @param {Array} promises - The array of promises.
 * @returns {Promise} The promise that resolves when all promises are settled.
 */
export const promiseAllSettled = (promises) =>
    Promise.all(
        promises.map((p) =>
            p
                .then((value) => ({
                    status: 'fulfilled',
                    value,
                }))
                .catch((reason) => ({
                    status: 'rejected',
                    reason,
                }))
        )
    );
