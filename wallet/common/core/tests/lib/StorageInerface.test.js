import { StorageInterface } from '../../src/lib/storage/StorageInterface';
import { jest } from '@jest/globals';

describe('StorageInterface', () => {
	it('creates a storage instance with provided methods', () => {
		// Arrange:
		const getItem = () => { };
		const setItem = () => { };
		const removeItem = () => { };

		// Act:
		const storage = new StorageInterface({ getItem, setItem, removeItem });

		// Assert:
		expect(storage.getItem).toBe(getItem);
		expect(storage.setItem).toBe(setItem);
		expect(storage.removeItem).toBe(removeItem);
	});

	it('creates a scoped storage instance', async () => {
		// Arrange:
		const getItem = jest.fn();
		const setItem = jest.fn();
		const removeItem = jest.fn();

		// Act:
		const storage = new StorageInterface({ getItem, setItem, removeItem });
		const scopedStorageInterface = storage.createScope('testScope');

		// Assert:
		expect(scopedStorageInterface).toBeInstanceOf(StorageInterface);
	});

	it('scoped methods', async () => {
		// Arrange:
		const returnValue = 'testValue';
		const getItem = jest.fn().mockResolvedValue(returnValue);
		const setItem = jest.fn().mockResolvedValue(returnValue);
		const removeItem = jest.fn().mockResolvedValue(returnValue);
		const scope = 'testScope';
		const storage = new StorageInterface({ getItem, setItem, removeItem }).createScope(scope);
		const key = 'testKey';
		const expectedScopedKey = `${scope}:${key}`;

		// Act:
		const getResult = await storage.getItem(key);
		const setResult = await storage.setItem(key, 1);
		const removeResult = await storage.removeItem(key);

		// Assert:
		expect(getItem).toHaveBeenCalledWith(expectedScopedKey);
		expect(setItem).toHaveBeenCalledWith(expectedScopedKey, 1);
		expect(removeItem).toHaveBeenCalledWith(expectedScopedKey);
		expect(getResult).toBe(returnValue);
		expect(setResult).toBe(returnValue);
		expect(removeResult).toBe(returnValue);
	});
});
