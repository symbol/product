import { validateFields } from '../../utils/helper';

/** @typedef {import('../../types/Storage').StorageOptions} StorageOptions */

/**
 * @callback GetItemFn
 * @param {string} key - The key of the item to retrieve.
 * @returns {Promise<any>} A promise that resolves to the retrieved value.
 */

/**
 * @callback SetItemFn
 * @param {string} key - The key of the item to store.
 * @param {any} value - The value to store.
 * @returns {Promise<void>} A promise that resolves when the item is stored.
 */

/**
 * @callback RemoveItemFn
 * @param {string} key - The key of the item to remove.
 * @returns {Promise<void>} A promise that resolves when the item is removed.
 */

const requiredMethods = [
	'getItem',
	'setItem',
	'removeItem'
];

/**
 * @description This class provides a generic interface for storage operations.
 * It abstracts the underlying storage mechanism, allowing for retrieval, storage, and removal of items.
 */
export class StorageInterface {
	/**
	 * @type {GetItemFn}
	 * @description Retrieves an item from storage by key.
	 */
	getItem;

	/**
	 * @type {SetItemFn}
	 * @description Stores an item in storage under the given key.
	 */
	setItem;

	/**
	 * @type {RemoveItemFn}
	 * @description Removes an item from storage by key.
	 */
	removeItem;

	/**
	 * @description Constructs a StorageInterface with the provided methods.
	 * @param {StorageOptions} options - The storage method implementations.
	 * @param {GetItemFn} options.getItem - Function to get an item by key.
	 * @param {SetItemFn} options.setItem - Function to set an item by key.
	 * @param {RemoveItemFn} options.removeItem - Function to remove an item by key.
	 * @throws {Error} If any required method is missing or not a function.
	 */
	constructor(options) {
		validateFields(options, requiredMethods.map(method => ({ key: method, type: 'function' })));
		const _this = this;
		requiredMethods.forEach(method => {
			_this[method] = options[method];
		});
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
