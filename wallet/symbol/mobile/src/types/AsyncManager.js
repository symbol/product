/**
 * Represents an asynchronous operation manager object.
 * 
 * @template T The type of data returned by the async operation.
 * 
 * @typedef {Object} AsyncManager
 * @property {function(...*): Promise<T>} call - The function to execute the async operation, returning a Promise of type T.
 * @property {boolean} isLoading - Indicates if the operation is currently loading.
 * @property {boolean} isCompleted - Indicates if the operation has completed.
 * @property {T} data - The data returned from the async operation.
 * @property {*} error - The error object if the operation failed.
 * @property {function()} reset - A function to reset the state to default values.
 */

export {};
