/** @typedef {import('@/app/types/ColorVariants').IconColorVariants} IconColorVariants */

/**
 * Icon component config.
 * @typedef {object} IconConfig
 * @property {Record<IconColorVariants, string>} variants - Icon folder name for each icon variant.
 */

/**
 * Size configuration bundle for token image - maps size identifiers to image names.
 * @typedef {object} TokenImageNames
 * @property {string} small - Image name for the small size.
 * @property {string} medium - Image name for the medium size.
 * @property {string} large - Image name for the large size.
 */

/**
 * Token avatar config of a brand.
 * @typedef {object} TokenAvatarConfig
 * @property {Record<string, TokenImageNames>} images - Image id to size bundle map.
 */

export {};
