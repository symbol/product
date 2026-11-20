import { $t } from '@/app/localization';

/** @typedef {import('@/app/types/Filter').FilterItem} FilterItem */
/** @typedef {import('@/contract/types/Config').FilterItemConfig} FilterItemConfig */

/**
 * Builds filter chip items from filter configs by translating their title and option label locale keys.
 * @param {FilterItemConfig[]} filterConfigs - The filter configs.
 * @returns {FilterItem[]} The filter chip items.
 */
export const buildFilterItems = filterConfigs => filterConfigs.map(filter => ({
	name: filter.name,
	title: $t(filter.titleKey),
	type: filter.type,
	options: filter.options?.map(option => ({ label: $t(option.labelKey), value: option.value })),
	value: filter.value
}));
