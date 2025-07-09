import { ExternalAccountKeystore } from '../../src/lib/keystore/ExternalAccountKeystore';
import { externalKeystoreAccounts, networkIdentifiers } from '../fixtures/wallet';
import { runBaseSoftwareKeystoreTest } from '../test-utils/keystore';
import { createStorageMock } from '../test-utils/storage';
import { jest } from '@jest/globals';

describe('ExternalAccountKeystore', () => {
	const password = 'test-password';

	let keystore;

	beforeEach(() => {
		keystore = new ExternalAccountKeystore({ 
			secureStorageInterface: createStorageMock({}), 
			sdk: {
				createPrivateAccount: jest.fn()
			}, 
			networkIdentifiers 
		});
	});

	runBaseSoftwareKeystoreTest(ExternalAccountKeystore);

	it('has correct static type', () => {
		// Act & Assert:
		expect(ExternalAccountKeystore.type).toBe('external');
	});

	describe('loadCache()', () => {
		it('loads accounts from secure storage', async () => {
			// Arrange:
			jest.spyOn(keystore.secureStorageRepository, 'getAccounts').mockResolvedValue(externalKeystoreAccounts);

			// Act:
			await keystore.loadCache(password);

			// Assert:
			expect(keystore.secureStorageRepository.getAccounts).toHaveBeenCalledWith(password);
			expect(keystore._state.privateAccounts).toStrictEqual(externalKeystoreAccounts);
		});
	});

	describe('addAccount()', () => {
		it('adds a new account to the keystore', async () => {
			// Arrange:
			const privateAccount = {
				publicKey: 'new-public-key',
				privateKey: 'new-private-key',
				networkIdentifier: 'testnet'
			};
			const expectedReturnedAccount = {
				publicKey: privateAccount.publicKey,
				networkIdentifier: privateAccount.networkIdentifier
			};
			const expectedAccounts = {
				testnet: [privateAccount],
				mainnet: []
			};
			jest.spyOn(keystore.secureStorageRepository, 'setAccounts').mockResolvedValue();
			jest.spyOn(keystore.sdk, 'createPrivateAccount').mockReturnValue(privateAccount);

			// Act:
			const result = await keystore.addAccount(privateAccount.privateKey, privateAccount.networkIdentifier, password);

			// Assert:
			expect(result).toStrictEqual(expectedReturnedAccount);
			expect(keystore.secureStorageRepository.setAccounts).toHaveBeenCalledWith(expectedAccounts, password);
			expect(keystore._state.privateAccounts).toStrictEqual(expectedAccounts);
		});
	});

	describe('removeAccount()', () => {
		it('removes an account from the keystore', async () => {
			// Arrange:
			const accountToRemove = externalKeystoreAccounts.testnet[0];
			const initialAccounts = {
				testnet: [...externalKeystoreAccounts.testnet],
				mainnet: [...externalKeystoreAccounts.mainnet]
			};
			const updatedAccounts = {
				testnet: [],
				mainnet: [...externalKeystoreAccounts.mainnet]
			};
			jest.spyOn(keystore.secureStorageRepository, 'setAccounts').mockResolvedValue();
			jest.spyOn(keystore.secureStorageRepository, 'getAccounts')
				.mockResolvedValueOnce(initialAccounts)
				.mockResolvedValueOnce(updatedAccounts);

			// Act:
			await keystore.removeAccount(accountToRemove.publicKey, accountToRemove.networkIdentifier, password);

			// Assert:
			expect(keystore.secureStorageRepository.setAccounts).toHaveBeenCalledWith(updatedAccounts, password);
			expect(keystore._state.privateAccounts).toStrictEqual(updatedAccounts);
		});
	});

	describe('clear()', () => {
		it('resets state and clear storage', async () => {
			// Arrange:
			jest.spyOn(keystore.secureStorageRepository, 'clear').mockResolvedValue();
			keystore._state.privateAccounts = externalKeystoreAccounts;
			const expectedClearedState = {
				privateAccounts: {
					testnet: [],
					mainnet: []
				}
			};

			// Act:
			await keystore.clear();

			// Assert:
			expect(keystore._state).toStrictEqual(expectedClearedState);
			expect(keystore.secureStorageRepository.clear).toHaveBeenCalled();
		});
	});
});
