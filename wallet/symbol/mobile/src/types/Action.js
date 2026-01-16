/**
 * @typedef {'pending' | 'loading' | 'completed' | 'error'} ActionStatus
 */

/**
 * @typedef {Object} ActionState
 * @property {ActionStatus} status - Current status of the action
 * @property {string} [errorMessage] - Error message if status is 'error'
 */

export {};
