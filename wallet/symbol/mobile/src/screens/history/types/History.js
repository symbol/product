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

export {};
