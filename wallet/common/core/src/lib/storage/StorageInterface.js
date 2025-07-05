/**
 * @typedef {Object} StorageOptions
 * @property {(key: string) => Promise<any>} getItem - Function to get an item by key.
 * @property {(key: string, value: any) => Promise<void>} setItem - Function to set an item by key.
 * @property {(key: string) => Promise<void>} removeItem - Function to remove an item by key.
 */

/**
 * @constructor StorageInterface
 * @classdesc Storage class for managing key-value pairs.
 * @param {StorageOptions} options - The storage functions.
 */
export class StorageInterface {
	/**
	 * @type {(key: string) => Promise<any>}
	 */
	getItem;

	/**
	 * @type {(key: string, value: any) => Promise<void>}
	 */
	setItem;

	/**
	 * @type {(key: string) => Promise<void>}
	 */
	removeItem;
	
	/**
	 * @param {StorageOptions} options - The storage functions.
	 */
	constructor({ getItem, setItem, removeItem }) {
		this.getItem = getItem;
		this.setItem = setItem;
		this.removeItem = removeItem;
	}

	/**
	 * Creates a scoped StorageInterface instance.
	 * @param {string} scope - The scope prefix.
	 * @returns {StorageInterface} - A new StorageInterface instance scoped to the provided prefix.
	 */
	createScope = scope => {
		return new StorageInterface({
			getItem: key => this.getItem(`${scope}:${key}`),
			setItem: (key, value) => this.setItem(`${scope}:${key}`, value),
			removeItem: key => this.removeItem(`${scope}:${key}`)
		});
	};
}
