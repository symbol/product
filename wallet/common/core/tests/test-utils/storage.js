import { StorageInterface } from '../../src/lib/storage/StorageInterface';
import { jest } from '@jest/globals';

export const createStorageMock = (initialState, scope) => {
	const state = { ...initialState };
	const getKey = key => {
		return scope ? key.replace(`${scope}:`, '') : key;
	};

	return new StorageInterface({
		getItem: jest.fn().mockImplementation(key => {
			return Promise.resolve(state[getKey(key)] || null);
		}),
		setItem: jest.fn().mockImplementation((key, value) => {
			state[getKey(key)] = value;
			return Promise.resolve();
		}),
		removeItem: jest.fn().mockImplementation(key => {
			delete state[getKey(key)];
			return Promise.resolve();
		})
	});
};
