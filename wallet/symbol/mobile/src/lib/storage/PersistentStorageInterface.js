import AsyncStorage from '@react-native-async-storage/async-storage';

export class PersistentStorageInterface {
	/**
	 * Get an item from persistent storage.
	 * @param {string} key - The key of the item to retrieve.
	 * @returns {Promise<any>} - A promise that resolves with the item value.
	 */
	static getItem(key) {
		return AsyncStorage.getItem(key);
	}

	/**
	 * Set an item in persistent storage.
	 * @param {string} key - The key of the item to set.
	 * @param {any} value - The value of the item to set.
	 * @returns {Promise<void>} - A promise that resolves when the item is set.
	 */
	static setItem(key, value) {
		return AsyncStorage.setItem(key, value);
	}

	/**
	 * Remove an item from persistent storage.
	 * @param {string} key - The key of the item to remove.
	 * @returns {Promise<void>} - A promise that resolves when the item is removed.
	 */
	static removeItem(key) {
		return AsyncStorage.removeItem(key);
	}
}



