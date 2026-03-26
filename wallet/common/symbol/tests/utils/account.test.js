import { NetworkIdentifier } from '../../src/constants';
import {
	addressFromPrivateKey,
	addressFromPublicKey,
	addressFromRaw,
	createPrivateAccount,
	createWalletAccount,
	generateKeyPair,
	isPrivateKey,
	isPublicKey,
	isSymbolAddress,
	normalizeAddress,
	publicAccountFromPrivateKey,
	publicAccountFromPublicKey
} from '../../src/utils';
import { walletStorageAccounts } from '../__fixtures__/local/wallet';
import { forEachNetwork } from '../test-utils';

const keyTests = [
	{
		description: 'returns false if the input is not a string',
		config: { inputs: [123, null, undefined, [], {}, () => {}, true] },
		expected: { result: false }
	},
	{
		description: 'returns false if the input is not a valid key',
		config: { input: 'invalid' },
		expected: { result: false }
	}
];

const runKeyTest = (fn, description, config, expected) => {
	it(description, () => {
		// Arrange:
		const inputs = config.inputs ?? [config.input];

		// Act & Assert:
		inputs.forEach(input => expect(fn(input)).toBe(expected.result));
	});
};


describe('utils/account', () => {
	describe('generateKeyPair', () => {
		it('generates a random key pair', () => {
			// Arrange:
			const keyLength = 64;

			// Act:
			const result = generateKeyPair();

			// Assert:
			expect(result).toHaveProperty('privateKey');
			expect(typeof result.privateKey).toBe('string');
			expect(result.privateKey.length).toBe(keyLength);

			expect(result).toHaveProperty('publicKey');
			expect(typeof result.publicKey).toBe('string');
			expect(result.publicKey.length).toBe(keyLength);
		});
	});

	describe('addressFromPrivateKey', () => {
		it('generates the account address from a given private key', () => {
			forEachNetwork(walletStorageAccounts, (networkIdentifier, account) => {
				// Arrange:
				const expectedResult = account.address;

				// Act:
				const result = addressFromPrivateKey(account.privateKey, networkIdentifier);

				// Assert:
				expect(result).toBe(expectedResult);
			});
		});
	});

	describe('addressFromPublicKey', () => {
		it('generates the account address from a given public key', () => {
			forEachNetwork(walletStorageAccounts, (networkIdentifier, account) => {
				// Arrange:
				const expectedResult = account.address;

				// Act:
				const result = addressFromPublicKey(account.publicKey, networkIdentifier);

				// Assert:
				expect(result).toBe(expectedResult);
			});
		});
	});

	describe('publicAccountFromPrivateKey', () => {
		it('creates the public account from a given private key', () => {
			forEachNetwork(walletStorageAccounts, (networkIdentifier, account) => {
				// Arrange:
				const expectedResult = {
					address: account.address,
					publicKey: account.publicKey,
					networkIdentifier
				};

				// Act:
				const result = publicAccountFromPrivateKey(account.privateKey, networkIdentifier);

				// Assert:
				expect(result).toStrictEqual(expectedResult);
			});
		});
	});

	describe('publicAccountFromPublicKey', () => {
		it('creates the public account from a given public key', () => {
			forEachNetwork(walletStorageAccounts, (networkIdentifier, account) => {
				// Arrange:
				const expectedResult = {
					address: account.address,
					publicKey: account.publicKey,
					networkIdentifier
				};

				// Act:
				const result = publicAccountFromPublicKey(account.publicKey, networkIdentifier);

				// Assert:
				expect(result).toStrictEqual(expectedResult);
			});
		});
	});

	describe('createWalletAccount', () => {
		it('creates wallet account object', () => {
			forEachNetwork(walletStorageAccounts, (networkIdentifier, account) => {
				// Arrange:
				const expectedResult = {
					address: account.address,
					publicKey: account.publicKey,
					name: account.name,
					networkIdentifier,
					accountType: account.accountType,
					index: account.index
				};

				// Act:
				const result = createWalletAccount(account.privateKey, networkIdentifier, account.name, account.accountType, account.index);

				// Assert:
				expect(result).toStrictEqual(expectedResult);
			});
		});
	});

	describe('createPrivateAccount', () => {
		it('creates wallet account object which contains private key', () => {
			forEachNetwork(walletStorageAccounts, (networkIdentifier, account) => {
				// Arrange:
				const expectedResult = {
					address: account.address,
					publicKey: account.publicKey,
					networkIdentifier,
					accountType: account.accountType,
					index: account.index,
					privateKey: account.privateKey
				};

				// Act:
				const result = createPrivateAccount(
					account.privateKey,
					networkIdentifier,
					account.accountType,
					account.index
				);

				// Assert:
				expect(result).toStrictEqual(expectedResult);
			});
		});
	});

	describe('isPrivateKey', () => {
		const privateKeyTests = [
			{
				description: 'returns true if the input is a private key',
				config: { input: 'F94C017383A5FE74B5AB56B9EA09534E9C7F4DF299A80428C883B8124B60B710' },
				expected: { result: true }
			},
			...keyTests
		];

		privateKeyTests.forEach(({ description, config, expected }) => {
			runKeyTest(isPrivateKey, description, config, expected);
		});
	});

	describe('isPublicKey', () => {
		const publicKeyTests = [
			{
				description: 'returns true if the input is a public key',
				config: { input: 'A55C641506CE1A9E097A551DF9B6FC5C58AC9C22E6B0368EBAED0184CD9ADDAB' },
				expected: { result: true }
			},
			...keyTests
		];

		publicKeyTests.forEach(({ description, config, expected }) => {
			runKeyTest(isPublicKey, description, config, expected);
		});
	});

	describe('isSymbolAddress', () => {
		const runIsSymbolAddressTest = (input, expectedResult, networkIdentifier) => {
			// Act:
			const result = isSymbolAddress(input, networkIdentifier);

			// Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns true if the input is a Symbol address', () => {
			// Arrange:
			const address = 'NCSMSP2GSGWM5DHLJV5QXK4447UTCRK2EPKLWSA';
			const expectedResult = true;

			// Act & Assert:
			runIsSymbolAddressTest(address, expectedResult);
		});

		it('returns false if the input is not a string', () => {
			// Arrange:
			const inputs = [123, null, undefined, [], {}, () => {}, true];
			const expectedResult = false;

			// Act & Assert:
			inputs.forEach(input => runIsSymbolAddressTest(input, expectedResult));
		});

		it('returns false if the input is not a Symbol address', () => {
			// Arrange:
			const input = 'invalid';
			const expectedResult = false;

			// Act & Assert:
			runIsSymbolAddressTest(input, expectedResult);
		});

		it('returns true for a valid address when the matching network is provided', () => {
			forEachNetwork(walletStorageAccounts, (networkIdentifier, account) => {
				// Arrange:
				const expectedResult = true;

				// Act & Assert:
				runIsSymbolAddressTest(account.address, expectedResult, networkIdentifier);
			});
		});

		it('returns false for a valid address when the wrong network is provided', () => {
			forEachNetwork(walletStorageAccounts, (networkIdentifier, account) => {
				// Arrange: flip the network identifier
				const wrongNetwork =
					networkIdentifier === NetworkIdentifier.MAIN_NET
						? NetworkIdentifier.TEST_NET
						: NetworkIdentifier.MAIN_NET;
				const expectedResult = false;

				// Act & Assert:
				runIsSymbolAddressTest(account.address, expectedResult, wrongNetwork);
			});
		});

		it('returns false when an unknown network identifier is provided', () => {
			forEachNetwork(walletStorageAccounts, (networkIdentifier, account) => {
				// Arrange:
				const unknownNetwork = 'UNKNOWN_NETWORK';
				const expectedResult = false;

				// Act & Assert:
				runIsSymbolAddressTest(account.address, expectedResult, unknownNetwork);
			});
		});
	});

	describe('addressFromRaw', () => {
		it('converts a raw address to a Symbol address', () => {
			// Arrange:
			const rawAddress = '982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6';
			const expectedResult = 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ';

			// Act:
			const result = addressFromRaw(rawAddress);

			// Assert:
			expect(result).toBe(expectedResult);
		});
	});

	describe('normalizeAddress', () => {
		it('returns uppercase address without dashes', () => {
			// Arrange:
			const address = 'NALS-BRWZ-TK3W-QEGZ-25NO-4YH2-MOU4S';
			const expectedResult = 'NALSBRWZTK3WQEGZ25NO4YH2MOU4S';

			// Act:
			const result = normalizeAddress(address);

			// Assert:
			expect(result).toBe(expectedResult);
		});

		it('converts lowercase address to uppercase', () => {
			// Arrange:
			const address = 'nalsbrwztk3wqegz25no4yh2mou4sxyy6avy72i';
			const expectedResult = 'NALSBRWZTK3WQEGZ25NO4YH2MOU4SXYY6AVY72I';

			// Act:
			const result = normalizeAddress(address);

			// Assert:
			expect(result).toBe(expectedResult);
		});

		it('returns already normalized address unchanged', () => {
			// Arrange:
			const address = 'NALSBRWZTK3WQEGZ25NO4YH2MOU4SXYY6AVY72I';

			// Act:
			const result = normalizeAddress(address);

			// Assert:
			expect(result).toBe(address);
		});

		it('throws TypeError when address is not a string', () => {
			// Act & Assert:
			expect(() => normalizeAddress(123)).toThrow(TypeError);
			expect(() => normalizeAddress(null)).toThrow(TypeError);
			expect(() => normalizeAddress(undefined)).toThrow(TypeError);
		});
	});
});
