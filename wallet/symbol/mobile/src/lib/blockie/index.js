import { BlockieGenerator } from './vendors/main';
import { hslToRgba } from '@/app/lib/blockie/vendors/hsl2rgb';

/**
 * @typedef {Object} Blockie
 * @property {string} image - Base64-encoded PNG image data URI
 * @property {string} background - RGB color string for background
 * @property {string} foreground - RGB color string for foreground
 * @property {string} spot - RGB color string for spot color
 */

const blockieGenerator = new BlockieGenerator({
	saturationMax: 90,
	saturationMin: 80,
	lightnessMax: 80,
	lightnessMin: 70,
	colorFactor: 2.3
});

/**
 * Creates an RGB color string from HSL values.
 * @param {number[]} hsl - The HSL color values as [hue, saturation, lightness]
 * @returns {string} The RGB color string in format 'rgb(r, g, b)'
 */
const createColorString = hsl => {
	const [red, green, blue] = hslToRgba(...hsl);
    
	return `rgb(${red}, ${green}, ${blue})`;
};

/**
 * Generates a blockie image and associated colors for a given address.
 * @param {string} address - The input address to generate the blockie for
 * @returns {Blockie} An object containing the image (base64) and colors
 */
export const generateBlockie = address => {
	const { 
		imageBase64, 
		backgroundColor,
		foregroundColor,
		spotColor
	} = blockieGenerator.generate(address);

	return {
		image: `data:image/png;base64,${imageBase64}`,
		background: createColorString(backgroundColor),
		foreground: createColorString(foregroundColor),
		spot: createColorString(spotColor)
	};
};
