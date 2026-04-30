import { hslToRgba } from './hsl2rgb';
import { PngImage } from './pnglib';

/** Number of colors in the palette (background, foreground, spot) */
const PALETTE_COLOR_COUNT = 3;

/** Pixel values for different colors */
const PIXEL_BACKGROUND = 0;
const PIXEL_FOREGROUND = 1;
const PIXEL_SPOT = 2;

const DEFAULT_GRID_SIZE = 8;
const DEFAULT_SCALE = 16;
const DEFAULT_HUE_MAX = 360;
const DEFAULT_SATURATION_MIN = 40;
const DEFAULT_SATURATION_MAX = 100;
const DEFAULT_LIGHTNESS_MIN = 40;
const DEFAULT_LIGHTNESS_MAX = 60;
const DEFAULT_COLOR_FACTOR = 2.3;

/**
 * @typedef {object} BlockieConfig
 * @property {number} [gridSize] - Size of the blockie grid.
 * @property {number} [scale] - Scale factor (pixels per cell).
 * @property {number} [hueMax] - Maximum hue value (0-360 degrees).
 * @property {number} [saturationMin] - Minimum saturation percentage.
 * @property {number} [saturationMax] - Maximum saturation percentage.
 * @property {number} [lightnessMin] - Minimum lightness percentage.
 * @property {number} [lightnessMax] - Maximum lightness percentage.
 * @property {number} [colorFactor] - Color probability factor.
 * Determines foreground/background vs spot color ratio.
 */

/**
 * @typedef {object} BlockieResult
 * @property {string} imageBase64 - Base64-encoded PNG data.
 * @property {number[]} backgroundColor - HSL values for background color.
 * @property {number[]} foregroundColor - HSL values for foreground color.
 * @property {number[]} spotColor - HSL values for spot color.
 */


/**
 * Generator class for creating blockie images.
 * A blockie is a deterministic, symmetric pattern used as an avatar.
 */
export class BlockieGenerator {
	/**
     * Create a new BlockieGenerator instance.
     * @param {BlockieConfig} [config={}] - Configuration options.
     */
	constructor(config = {}) {
		this.gridSize = config.gridSize ?? DEFAULT_GRID_SIZE;
		this.scale = config.scale ?? DEFAULT_SCALE;
		this.hueMax = config.hueMax ?? DEFAULT_HUE_MAX;
		this.saturationMin = config.saturationMin ?? DEFAULT_SATURATION_MIN;
		this.saturationMax = config.saturationMax ?? DEFAULT_SATURATION_MAX;
		this.lightnessMin = config.lightnessMin ?? DEFAULT_LIGHTNESS_MIN;
		this.lightnessMax = config.lightnessMax ?? DEFAULT_LIGHTNESS_MAX;
		this.colorFactor = config.colorFactor ?? DEFAULT_COLOR_FACTOR;

		// Xorshift PRNG state: [x, y, z, w] - 32-bit values
		this.randomState = new Array(4);
	}


	/**
     * Initialize the random number generator with a seed string.
     * Uses a hash algorithm similar to Java's String.hashCode().
     * @param {string} seed - The seed string to initialize the PRNG.
     * @private
     */
	_initializeRandomSeed(seed) {
		// Reset state to zeros
		for (let index = 0; index < this.randomState.length; index++) 
			this.randomState[index] = 0;

		// Hash each character into the state
		for (let index = 0; index < seed.length; index++) {
			const stateIndex = index % 4;
			this.randomState[stateIndex] = (this.randomState[stateIndex] << 5) - this.randomState[stateIndex] + seed.charCodeAt(index);
		}
	}

	/**
     * Generate a random number between 0 and 1 using Xorshift algorithm.
     * Based on Java's String.hashCode(), expanded to 4 32-bit values.
     * @returns {number} Random number in range [0, 1).
     * @private
     */
	_generateRandomNumber() {
		const temp = this.randomState[0] ^ (this.randomState[0] << 11);

		this.randomState[0] = this.randomState[1];
		this.randomState[1] = this.randomState[2];
		this.randomState[2] = this.randomState[3];
		this.randomState[3] = this.randomState[3] ^ (this.randomState[3] >> 19) ^ temp ^ (temp >> 8);

		return (this.randomState[3] >>> 0) / (1 << 31 >>> 0);
	}

	/**
     * Generate a random HSL color based on configured ranges.
     * @returns {number[]} HSL values as [hue, saturation, lightness] in range [0, 1].
     * @private
     */
	_generateRandomColor() {
		const saturationRange = this.saturationMax - this.saturationMin;
		const lightnessRange = this.lightnessMax - this.lightnessMin;

		const hue = Math.floor(this._generateRandomNumber() * this.hueMax);
		const saturation = Math.floor((this._generateRandomNumber() * saturationRange) + this.saturationMin);
		const lightness = Math.floor((this._generateRandomNumber() * lightnessRange) + this.lightnessMin);

		return [
			hue / this.hueMax,
			saturation / 100,
			lightness / 100
		];
	}

	/**
     * Generate the pixel data for a blockie pattern.
     * Creates a symmetric pattern by mirroring the left half to the right.
     * @returns {number[]} Array of pixel values (0 = background, 1 = foreground, 2 = spot).
     * @private
     */
	_generatePatternData() {
		const dataWidth = Math.ceil(this.gridSize / 2);
		const mirrorWidth = this.gridSize - dataWidth;
		const pixelData = [];

		for (let row = 0; row < this.gridSize; row++) {
			// Generate left half of the row
			const leftHalf = [];
			for (let column = 0; column < dataWidth; column++) {
				// Probability distribution based on colorFactor
				leftHalf[column] = Math.floor(this._generateRandomNumber() * this.colorFactor);
			}

			// Create mirrored right half
			const rightHalf = leftHalf.slice(0, mirrorWidth).reverse();
			const fullRow = leftHalf.concat(rightHalf);

			// Add row to pixel data
			pixelData.push(...fullRow);
		}

		return pixelData;
	}

	/**
     * Fill a rectangle in the PNG image with a specified color.
     * @param {PngImage} pngImage - The PNG image to modify.
     * @param {number} startX - Starting X coordinate.
     * @param {number} startY - Starting Y coordinate.
     * @param {number} rectWidth - Width of the rectangle.
     * @param {number} rectHeight - Height of the rectangle.
     * @param {string} colorIndex - The palette color index to use.
     * @private
     */
	_fillRectangle(pngImage, startX, startY, rectWidth, rectHeight, colorIndex) {
		for (let offsetX = 0; offsetX < rectWidth; offsetX++) {
			for (let offsetY = 0; offsetY < rectHeight; offsetY++) 
				pngImage.buffer[pngImage.getPixelIndex(startX + offsetX, startY + offsetY)] = colorIndex;
		}
	}

	/**
     * Generate a blockie image from an address string.
     * @param {string} address - The address to generate a blockie for.
     * @returns {BlockieResult} Object containing the image data and colors.
     */
	generate(address) {
		// Initialize PRNG with lowercase address as seed
		this._initializeRandomSeed(address.toLowerCase());

		// Generate colors
		const foregroundColor = this._generateRandomColor();
		const backgroundColor = this._generateRandomColor();
		const spotColor = this._generateRandomColor();

		// Generate pattern
		const patternData = this._generatePatternData();
		const gridWidth = Math.sqrt(patternData.length);
		const imageSize = this.gridSize * this.scale;

		// Create PNG image with palette for 3 colors
		const pngImage = new PngImage(imageSize, imageSize, PALETTE_COLOR_COUNT);

		// Register colors in palette
		pngImage.registerColor(...hslToRgba(...backgroundColor));
		const foregroundColorIndex = pngImage.registerColor(...hslToRgba(...foregroundColor));
		const spotColorIndex = pngImage.registerColor(...hslToRgba(...spotColor));

		// Render each pixel of the pattern
		for (let pixelIndex = 0; pixelIndex < patternData.length; pixelIndex++) {
			const row = Math.floor(pixelIndex / gridWidth);
			const column = pixelIndex % gridWidth;
			const pixelValue = patternData[pixelIndex];

			// Skip background pixels (value 0)
			PIXEL_SPOT;
			if (pixelValue !== PIXEL_BACKGROUND) {
				const colorIndex = pixelValue === PIXEL_FOREGROUND ? foregroundColorIndex : spotColorIndex;
				this._fillRectangle(
					pngImage,
					column * this.scale,
					row * this.scale,
					this.scale,
					this.scale,
					colorIndex
				);
			}
		}

		return {
			imageBase64: pngImage.getBase64(),
			backgroundColor,
			foregroundColor,
			spotColor
		};
	}
}
