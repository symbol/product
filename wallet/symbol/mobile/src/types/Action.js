/**
 * Lifecycle status of an async action.
 * @typedef {'pending' | 'loading' | 'completed' | 'error'} ActionStatus
 */

/**
 * Current state of an async action, including its status and optional error message.
 * @typedef {object} ActionState
 * @property {ActionStatus} status - Current status of the action.
 * @property {string} [errorMessage] - Error message if status is 'error'.
 */

export {};
