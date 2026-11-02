/** @typedef {import('react')} React */
/** @typedef {import('@/app/types/Button').ButtonType} ButtonType */
/** @typedef {import('@/app/types/ColorVariants').IconColorVariants} IconColorVariants */
/** @typedef {import('@/app/types/ColorVariants').InverseColorVariants} InverseColorVariants */
/** @typedef {import('./Component').HomeWidgetProps} HomeWidgetProps */
/** @typedef {import('./Component').TokenDetailsActionProps} TokenDetailsActionProps */

/**
 * AccountAvatar config.
 * @typedef {object} AccountAvatarConfig
 * @property {IconColorVariants} iconVariant - Variant of the account icon displayed on top of the generated blockie.
 */

/**
 * Data for a single action card on the actions screen.
 * @typedef {object} ActionItem
 * @property {string} id - Unique key of the card.
 * @property {string} titleKey - Translation key of the card title.
 * @property {string} descriptionKey - Translation key of the card description.
 * @property {number} imageSource - The image source for the card (require result).
 * @property {boolean} isDisabledForMultisig - Whether the card is disabled for a multisig account.
 * @property {function(): void} onPress - Callback function when the card is pressed.
 */

/**
 * Actions screen config.
 * @typedef {object} ActionsScreenConfig
 * @property {ActionItem[]} cards - Cards in display order.
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
 * Create wallet screen config.
 * @typedef {object} CreateWalletScreenConfig
 * @property {boolean} isLogoVisible - Whether the logo is shown at the top of the screen.
 * @property {boolean} isStepsVisible - Whether the step progress indicator is shown at the top of the screen.
 */

/**
 * FeeSelector config.
 * @typedef {object} FeeSelectorConfig
 * @property {boolean} isSpeedIconVisible - Whether the fee speed icon is shown on the right side of the selector.
 */

/**
 * Option in a select-type filter config.
 * @typedef {object} FilterOptionConfig
 * @property {string} labelKey - Filter option locale key of the displayed text.
 * @property {*} value - Filter option value.
 */

/**
 * Config of an individual filter item (chip).
 * @typedef {object} FilterItemConfig
 * @property {string} name - Filter field name. Choice filters use the same name, in other cases the name is unique.
 * @property {string} titleKey - Chip title locale key.
 * @property {'boolean'|'select'|'address'|'choice'} type - Type of filter.
 * @property {FilterOptionConfig[]} [options] - Options of the select type filter.
 * @property {*} [value] - Value set by a choice type filter.
 */

/**
 * History screen config.
 * @typedef {object} HistoryScreenConfig
 * @property {FilterItemConfig[]} filters - Filter config.
 */

/**
 * Widget config.
 * @typedef {object} HomeWidgetItem
 * @property {string} id - Random unique key.
 * @property {function(HomeWidgetProps): React.ReactNode} Component - Widget component.
 */

/**
 * Home screen config.
 * @typedef {object} HomeScreenConfig
 * @property {HomeWidgetItem[]} widgets - List of widgets that will be rendered on the Home screen.
 */

/**
 * Icon component config.
 * @typedef {object} IconConfig
 * @property {Record<IconColorVariants, string>} variants - Icon folder name for each icon variant.
 */

/**
 * Import wallet screen config.
 * @typedef {object} ImportWalletScreenConfig
 * @property {boolean} isLogoVisible - Whether the logo is shown at the top of the screen.
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

/**
 * Action sections displayed at the bottom of TokenDetails.
 * @typedef {object} TokenDetailsActionItem
 * @property {string} id - Unique key in the list.
 * @property {function(TokenDetailsActionProps): React.ReactNode} Component - Action block component.
 */

/**
 * TokenDetails screen config.
 * @typedef {object} TokenDetailsScreenConfig
 * @property {Record<string, TokenDetailsActionItem[]>} actionsByChain - Action blocks per token chain name, in display order.
 */

export {};
