import { BlockieGenerator } from './vendors/main';
import { hslToRgba } from '@/app/lib/blockie/vendors/hsl2rgb';

/**
 * Generated blockie image and associated color data for an account address.
 * @typedef {object} Blockie
 * @property {string} image - Base64-encoded PNG image data URI.
 * @property {string} background - RGB color string for background.
 * @property {string} foreground - RGB color string for foreground.
 * @property {string} spot - RGB color string for spot color.
 */

/**
 * Blockie colors without the image.
 * @typedef {Omit<Blockie, 'image'>} BlockieColors
 */

const MAX_CACHE_ENTRIES = 128;
const blockieCache = new Map();

const blockieGenerator = new BlockieGenerator({
	saturationMax: 90,
	saturationMin: 80,
	lightnessMax: 80,
	lightnessMin: 70,
	colorFactor: 2.3
});

/**
 * Creates an RGB color string from HSL values.
 * @param {number[]} hsl - The HSL color values as [hue, saturation, lightness].
 * @returns {string} The RGB color string in format 'rgb(r, g, b)'.
 */
const createColorString = hsl => {
	const [red, green, blue] = hslToRgba(...hsl);

	return `rgb(${red}, ${green}, ${blue})`;
};

/**
 * Generates the blockie colors for a given address without rendering the image.
 * Orders of magnitude cheaper than generateBlockie(). Use when only colors are needed.
 * @param {string} address - The input address to generate the colors for.
 * @returns {BlockieColors} An object containing the blockie colors.
 */
export const getBlockieColors = address => {
	const { backgroundColor, foregroundColor, spotColor } = blockieGenerator.generateColors(address);

	return {
		background: createColorString(backgroundColor),
		foreground: createColorString(foregroundColor),
		spot: createColorString(spotColor)
	};
};

/**
 * Generates a blockie image and associated colors for a given address.
 * Results are cached per address, with oldest entries evicted beyond the cap.
 * @param {string} address - The input address to generate the blockie for.
 * @returns {Blockie} An object containing the image (base64) and colors.
 */
export const generateBlockie = address => {
	const cacheKey = address.toLowerCase();
	const cachedBlockie = blockieCache.get(cacheKey);

	if (cachedBlockie)
		return cachedBlockie;

	const {
		imageBase64,
		backgroundColor,
		foregroundColor,
		spotColor
	} = blockieGenerator.generate(address);

	const blockie = {
		image: `data:image/png;base64,${imageBase64}`,
		background: createColorString(backgroundColor),
		foreground: createColorString(foregroundColor),
		spot: createColorString(spotColor)
	};

	if (blockieCache.size >= MAX_CACHE_ENTRIES)
		blockieCache.delete(blockieCache.keys().next().value);
	
	blockieCache.set(cacheKey, blockie);

	return blockie;
};
