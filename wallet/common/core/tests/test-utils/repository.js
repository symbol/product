import { StorageInterface } from '../../src/lib/storage/StorageInterface';
import { jest } from '@jest/globals';

export const runRepositoryTest = async (Repository, repositoryTestConfig) => {
	const createStorageInterfaceMock = storageValueGetter => {
		return new StorageInterface({
			getItem: jest.fn().mockImplementation(key => {
				const item = repositoryTestConfig.find(item => item.key === key);
				return Promise.resolve(storageValueGetter(item));
			}),
			setItem: jest.fn(),
			removeItem: jest.fn()
		});
	};

	const runGetterTest = async (repository, getterName, expectedResult) => {
		// Act:
		const result = await repository[getterName]();

		// Assert:
		expect(result).toStrictEqual(expectedResult);
	};


	describe('getters', () => {
		repositoryTestConfig.forEach(testConfig => {
			describe(`${testConfig.getterName}()`, () => {
				it('returns correct value when storage is empty', async () => {
					// Arrange:
					const storage = createStorageInterfaceMock(item => item.emptyStorageValue);
					const repository = new Repository(storage);

					// Act & Assert:
					await runGetterTest(repository, testConfig.getterName, testConfig.expectedEmptyValue);
				});

				it('returns correct value when storage is filled', async () => {
					// Arrange:
					const storage = createStorageInterfaceMock(item => item.filledStorageValue);
					const repository = new Repository(storage);

					// Act & Assert:
					await runGetterTest(repository, testConfig.getterName, testConfig.expectedFilledValue);
				});
			});
		});
	});

	describe('setters', () => {
		repositoryTestConfig.forEach(testConfig => {
			describe(`${testConfig.setterName}()`, () => {
				it('sets value into the storage by calling storage setter with correct key and payload', async () => {
					// Arrange:
					const storage = createStorageInterfaceMock(() => null);
					const repository = new Repository(storage);

					// Act:
					await repository[testConfig.setterName](...testConfig.setterArguments);

					// Assert:
					expect(storage.setItem).toHaveBeenCalledWith(testConfig.key, testConfig.storagePayload);
				});
			});
		});
	});

	describe('clear()', () => {
		it('clears all keys from the storage', async () => {
			// Arrange:
			const storage = createStorageInterfaceMock(() => null);
			const repository = new Repository(storage);

			// Act:
			await repository.clear();

			// Assert:
			repositoryTestConfig.forEach(testConfig => {
				expect(storage.removeItem).toHaveBeenCalledWith(testConfig.key);
			});
			expect(storage.removeItem).toHaveBeenCalledTimes(repositoryTestConfig.length);
		});
	});
};
