// Constants
const ONE_SIXTH = 1 / 6;
const ONE_THIRD = 1 / 3;
const ONE_HALF = 1 / 2;
const TWO_THIRDS = 2 / 3;
const RGB_MAX = 255;
const ALPHA_OPAQUE = 255;

/**
 * Helper function to convert a single hue component to RGB.
 * @param {number} primaryComponent - The primary color component (p)
 * @param {number} secondaryComponent - The secondary color component (q)
 * @param {number} hueOffset - The hue offset value (t)
 * @returns {number} The RGB component value in range [0, 1]
 */
const hueToRgbComponent = (primaryComponent, secondaryComponent, hueOffset) => {
	let normalizedHue = hueOffset;

	// Normalize hue to [0, 1] range
	if (normalizedHue < 0)
		normalizedHue += 1;

	if (normalizedHue > 1)
		normalizedHue -= 1;

	// Calculate RGB component based on hue position
	if (normalizedHue < ONE_SIXTH)
		return primaryComponent + ((secondaryComponent - primaryComponent) * 6 * normalizedHue);

	if (normalizedHue < ONE_HALF)
		return secondaryComponent;

	if (normalizedHue < TWO_THIRDS)
		return primaryComponent + ((secondaryComponent - primaryComponent) * (TWO_THIRDS - normalizedHue) * 6);

	return primaryComponent;
};

/**
 * Converts an HSL color value to RGBA.
 * Conversion formula adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 *
 * @param {number} hue - The hue value in range [0, 1]
 * @param {number} saturation - The saturation value in range [0, 1]
 * @param {number} lightness - The lightness value in range [0, 1]
 * @returns {number[]} The RGBA representation as [red, green, blue, alpha] with values in [0, 255]
 */
export const hslToRgba = (hue, saturation, lightness) => {
	let red, green, blue;

	if (saturation === 0) {
		// Achromatic (grayscale)
		red = green = blue = lightness;
	} else {
		const secondaryComponent = lightness < 0.5
			? lightness * (1 + saturation)
			: (lightness + saturation) - (lightness * saturation);
		const primaryComponent = (2 * lightness) - secondaryComponent;

		red = hueToRgbComponent(primaryComponent, secondaryComponent, hue + ONE_THIRD);
		green = hueToRgbComponent(primaryComponent, secondaryComponent, hue);
		blue = hueToRgbComponent(primaryComponent, secondaryComponent, hue - ONE_THIRD);
	}

	return [
		Math.round(red * RGB_MAX),
		Math.round(green * RGB_MAX),
		Math.round(blue * RGB_MAX),
		ALPHA_OPAQUE
	];
};
