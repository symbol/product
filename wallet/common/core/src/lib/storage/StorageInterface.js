import * as StorageTypes from '../../types/Storage';
import { validateFields } from '../../utils/helper';

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
	 * @param {StorageTypes.StorageOptions} options - The storage functions.
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
