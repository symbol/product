/**
 * Generic transaction kind, the same for all variants.
 * @typedef {'transfer' | 'aggregate' | 'other'} TransactionKind
 */

/**
 * Transaction type info that contains data for UI display.
 * @typedef {object} TransactionTypeInfo
 * @property {TransactionKind} kind - Generic transaction kind.
 * @property {string} localeKey - Type name localization key.
 * @property {string} icon - Icon file name without extension, from the variant "images/transaction" folder.
 */

export {};
