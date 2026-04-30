/**
 * A label/value pair representing one option in a select-type filter.
 * @typedef {object} FilterOption
 * @property {string} label - Display label for the option.
 * @property {*} value - Value of the option.
 */

/**
 * Configuration for a single filter chip (name, title, interaction type, and options).
 * @typedef {object} FilterItem
 * @property {string} name - Unique identifier for the filter.
 * @property {string} title - Display title for the filter chip.
 * @property {'boolean'|'select'|'address'} type - Type of filter interaction.
 * @property {FilterOption[]} [options] - Options for select type filters.
 */

/**
 * Dictionary mapping filter field names to their currently selected values.
 * @typedef {Record<string, *>} FilterValue
 */

/**
 * Filter type enum for categorizing filter behavior.
 * @readonly
 * @enum {string}
 */
export const FilterType = {
	BOOLEAN: 'boolean',
	SELECT: 'select',
	ADDRESS: 'address'
};
