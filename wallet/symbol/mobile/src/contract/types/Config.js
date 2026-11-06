/** @typedef {import('@/app/types/Button').ButtonType} ButtonType */
/** @typedef {import('@/app/types/ColorVariants').IconColorVariants} IconColorVariants */
/** @typedef {import('@/app/types/ColorVariants').InverseColorVariants} InverseColorVariants */

/**
 * AccountAvatar config.
 * @typedef {object} AccountAvatarConfig
 * @property {IconColorVariants} iconVariant - Variant of the account icon displayed on top of the generated blockie.
 */

/**
 * AddressBookWidget config.
 * @typedef {object} AddressBookWidgetConfig
 * @property {{ iconVariant: IconColorVariants }} addContactButton - Add contact button settings.
 */

/**
 * Button component config.
 * @typedef {object} ButtonConfig
 * @property {ButtonType} defaultType - Button type used when property is not provided.
 */

/**
 * FeeSelector config.
 * @typedef {object} FeeSelectorConfig
 * @property {boolean} isSpeedIconVisible - Whether the fee speed icon is shown on the right side of the selector.
 */

/**
 * Icon component config.
 * @typedef {object} IconConfig
 * @property {Record<IconColorVariants, string>} variants - Icon folder name for each icon variant.
 */

/**
 * MnemonicView config.
 * @typedef {object} MnemonicViewConfig
 * @property {InverseColorVariants} contentColorVariant - Color variant of the mnemonic text and the copy button.
 */

/**
 * SendReceiveButtons config.
 * @typedef {object} SendReceiveButtonsConfig
 * @property {IconColorVariants} iconVariant - Icon variant of the receive and send buttons.
 */

/**
 * StatusCard config.
 * @typedef {object} StatusCardConfig
 * @property {InverseColorVariants} contentColorVariant - Color variant of the status icon and the card content.
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
