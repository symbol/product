import { $t } from '@/app/localization';
import { showMessage as rnFlashMessage } from 'react-native-flash-message';

const CHARSET = '0123456789abcdefghijklmnopqrstuvwxyz';

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

    const hue2rgb = (p, q, _t) => {
        let t = _t;

        if (0 > t) 
            t += 1;
        if (1 < t) 
            t -= 1;
        if (t < 1 / 6) 
            return p + ((q - p) * 6 * t);
        if (t < 1 / 2) 
            return q;
        if (t < 2 / 3) 
            return p + ((q - p) * (((2 / 3) - t) * 6));
        return p;
    };

    if (0 === s) {
        r = g = b = l; // achromatic
    } else {
        const q = 0.5 > l ? l * (1 + s) : l + s - (l * s);
        const p = (2 * l) - q;

        r = hue2rgb(p, q, h + (1 / 3));
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - (1 / 3));
    }

    return {
        R: Math.round(r * 255),
        G: Math.round(g * 255),
        B: Math.round(b * 255)
    };
};

/**
 * Get RGB color from hash.
 * @param {string} hash - hash to be converted.
 * @param {boolean} isHex - default true
 * @returns {object} { R: Number, G: Number, B: Number }
 */
export const getColorFromHash = hash => {
    if (!hash) 
        return '#fff';
    
    const spread = 100;
    const saturation = 0.9;
    const lightness = 0.8;

    let totalValue = 0;

    for (const char of hash) 
        totalValue += CHARSET.indexOf(char.toLowerCase());

    const k = Math.trunc(totalValue / spread);
    const offsetValue = totalValue - (spread * k);
    const hue = offsetValue / 100;

    const color = hslToRgb(hue, saturation, lightness);

    return `rgb(${color.R}, ${color.G}, ${color.B})`;
};

/**
 * Calculates the percentage of a character in the charset.
 * @param {string} char - The character.
 * @returns {number} The percentage.
 */
export const getCharPercentage = char => {
	const index = CHARSET.indexOf(char.toLowerCase());

	return index / (CHARSET.length - 1);
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
export const handleError = error => {
    const translationKey = error.code || error.message;
    const message = $t(translationKey, { defaultValue: translationKey });
    showMessage({ message, type: 'danger' });
    
    if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error(error);
        console.log(error.code, error.message, error.statusCode);
    }
};
