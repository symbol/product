/** @typedef {import('react')} React */

/**
 * Account info page config.
 * @typedef {object} AccountInfoPageConfig
 * @property {boolean} isEmptyBlockFilterVisible - Whether the harvested blocks section shows the empty block filter.
 */

/**
 * Block list page config.
 * @typedef {object} BlockListPageConfig
 * @property {'page'|'cursor'} paginationMode - Pagination mode of the block list.
 * @property {boolean} isStatementCountColumnVisible - Whether the table shows the statement count column.
 * @property {boolean} isBlockRewardColumnVisible - Whether the table shows the block reward column.
 */

/**
 * Home page section config.
 * @typedef {object} HomeSectionItem
 * @property {string} id - Unique key in the list.
 * @property {function(): React.ReactNode} Component - Section component.
 */

/**
 * Home page config.
 * @typedef {object} HomePageConfig
 * @property {boolean} isSupernodeCountVisible - Whether the home page shows the supernode count.
 * @property {HomeSectionItem[]} sections - Variant sections rendered after the recent blocks.
 */

export {};
