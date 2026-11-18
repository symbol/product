/**
 * The refresh trigger bridge passed from the Home screen into the widgets.
 * @typedef {object} RefreshController
 * @property {function(function(): *): function(): void} subscribe - Adds a listener. Returns a function that removes it.
 * @property {function(): Promise<void>} refresh - Triggers a refresh on all subscribed widgets.
 */

export {};
