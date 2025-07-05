/**
 * @typedef {Object} StorageOptions
 * @property {(key: string) => Promise<any>} getItem - Function to get an item by key.
 * @property {(key: string, value: any) => Promise<void>} setItem - Function to set an item by key.
 * @property {(key: string) => Promise<void>} removeItem - Function to remove an item by key.
 */

/**
 * @typedef {Object} StorageInterface
 * @property {(key: string) => Promise<any>} getItem - Function to get an item by key.
 * @property {(key: string, value: any) => Promise<void>} setItem - Function to set an item by key.
 * @property {(key: string) => Promise<void>} removeItem - Function to remove an item by key.
 * @property {(scope: string) => StorageInterface} createScope - Function to create a scoped StorageInterface instance.
 */

export default {};
