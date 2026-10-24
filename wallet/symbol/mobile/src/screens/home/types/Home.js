/** @typedef {import('react')} React */

/**
 * Widget config.
 * @typedef {object} HomeWidgetItem
 * @property {string} id - Random unique key.
 * @property {function(object): React.ReactNode} Component - Widget component.
 */

/**
 * Home screen config.
 * @typedef {object} HomeScreenConfig
 * @property {HomeWidgetItem[]} widgets - List of widgets that will be rendered on the Home screen.
 */

export {};
