import EncryptedStorage from 'react-native-encrypted-storage';

export class SecureStorageInterface {
	/**
	 * Get an item from secure storage.
	 * @param {string} key - The key of the item to retrieve.
	 * @returns {Promise<any>} - A promise that resolves with the item value.
	 */
	static async getItem(key) {
		const item = await EncryptedStorage.getItem(key);

		if (item === undefined) 
			return null;

		return item;
	}

	/**
	 * Set an item in secure storage.
	 * @param {string} key - The key of the item to set.
	 * @param {any} value - The value of the item to set.
	 * @returns {Promise<void>} - A promise that resolves when the item is set.
	 */
	static setItem(key, value) {
		return EncryptedStorage.setItem(key, value);
	}

	/**
	 * Remove an item from secure storage.
	 * @param {string} key - The key of the item to remove.
	 * @returns {Promise<void>} - A promise that resolves when the item is removed.
	 */
	static async removeItem(key) {
		const item = await EncryptedStorage.getItem(key);
		
		if (item === undefined || item === null) 
			return;

		return EncryptedStorage.removeItem(key);
	}
}
