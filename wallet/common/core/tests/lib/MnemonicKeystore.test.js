import { MnemonicKeystore } from '../../src/lib/keystore/MnemonicKeystore';
import { mnemonic, mnemonicKeystoreAccounts, networkIdentifiers } from '../fixtures/wallet';
import { runBaseSoftwareKeystoreTest } from '../test-utils/keystore';
import { createStorageMock } from '../test-utils/storage';
import { jest } from '@jest/globals';

describe('MnemonicKeystore', () => {
	const password = 'test-password';

	let secureStorageInterface;
	let sdk;
	let keystore;

	beforeEach(() => {
		secureStorageInterface = createStorageMock({});
		sdk = {
			createPrivateKeysFromMnemonic: jest.fn().mockImplementation((mnemonic, indexes, networkIdentifier) => 
				mnemonicKeystoreAccounts[networkIdentifier].map(account => account.privateKey)),
			createPrivateAccount: jest.fn((privateKey, networkIdentifier, type, index) =>
				mnemonicKeystoreAccounts[networkIdentifier][index])
		};
		keystore = new MnemonicKeystore({ secureStorageInterface, sdk, networkIdentifiers });
		keystore.secureStorageRepository = {
			getMnemonic: jest.fn(() => Promise.resolve(mnemonic)),
			setMnemonic: jest.fn(() => Promise.resolve()),
			getAccounts: jest.fn(() => Promise.resolve(mnemonicKeystoreAccounts)),
			setAccounts: jest.fn(() => Promise.resolve()),
			clear: jest.fn(() => Promise.resolve())
		};
	});

	runBaseSoftwareKeystoreTest(MnemonicKeystore);

	it('has correct static type', () => {
		// Act & Assert:
		expect(MnemonicKeystore.type).toBe('mnemonic');
	});

	describe('loadCache()', () => {
		it('loads mnemonic and accounts from secure storage', async () => {
			// Act:
			await keystore.loadCache(password);

			// Assert:
			expect(keystore.secureStorageRepository.getMnemonic).toHaveBeenCalledWith(password);
			expect(keystore.secureStorageRepository.getAccounts).toHaveBeenCalledWith(password);
			expect(keystore._state.mnemonic).toBe(mnemonic);
			expect(keystore._state.privateAccounts).toStrictEqual(mnemonicKeystoreAccounts);
		});
	});

	describe('createWallet()', () => {
		it('creates and stores mnemonic and accounts', async () => {
			// Act:
			await keystore.createWallet(mnemonic, 1, password);

			// Assert:
			expect(keystore.secureStorageRepository.setMnemonic).toHaveBeenCalledWith(mnemonic, password);
			expect(sdk.createPrivateKeysFromMnemonic).toHaveBeenCalledWith(mnemonic, [0], 'testnet');
			expect(sdk.createPrivateAccount).toHaveBeenCalled();
			expect(keystore.secureStorageRepository.setAccounts).toHaveBeenCalled();
		});
	});

	describe('getMnemonic()', () => {
		it('returns the stored mnemonic', async () => {
			// Arrange:
			keystore._state.mnemonic = mnemonic;

			// Act:
			const result = await keystore.getMnemonic();

			// Assert:
			expect(result).toBe(mnemonic);
		});
	});

	describe('getSeedAccount()', () => {
		it('returns the correct account', async () => {
			// Arrange:
			keystore._state.privateAccounts = mnemonicKeystoreAccounts;
			const expectedResult = mnemonicKeystoreAccounts.testnet[0];

			// Act:
			const result = await keystore.getSeedAccount('testnet', 0);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		});

		it('throws an error if the network is not supported', async () => {
			// Arrange:
			keystore._state.privateAccounts = {};

			// Act & Assert:
			await expect(keystore.getSeedAccount('wrongnet', 0))
				.rejects.toThrow(/network "wrongnet" is not supported/i);
		});

		it('throws an error if the account index does not exist', async () => {
			// Arrange:
			keystore._state.privateAccounts = { testnet: [] };

			// Act & Assert:
			await expect(keystore.getSeedAccount('testnet', 0))
				.rejects.toThrow(/does not exist/i);
		});
	});

	describe('clear()', () => {
		it('resets state and clear storage', async () => {
			// Arrange:
			keystore._state.mnemonic = mnemonic;
			keystore._state.privateAccounts = mnemonicKeystoreAccounts;
			const expectedClearedState = {
				mnemonic: null,
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
