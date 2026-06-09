import { NetworkIdentifier } from '../../src/constants';
import {
	addressFromPrivateKey,
	addressFromPublicKey,
	addressFromRaw,
	createPrivateAccount,
	createWalletAccount,
	generateKeyPair,
	isNemAddress,
	isPrivateKey,
	isPublicKey,
	normalizeAddress,
	publicAccountFromPrivateKey,
	publicAccountFromPublicKey
} from '../../src/utils';
import { walletStorageAccounts } from '../__fixtures__/local/wallet';

// Constants

const KEY_LENGTH = 64;
const nonStringInputs = [123, null, undefined, [], {}, () => {}, true];

// Fixtures

const testnetAccount = walletStorageAccounts.testnet[0];
const mainnetAccount = walletStorageAccounts.mainnet[0];
const dashedTestnetAddress = testnetAccount.address.match(/.{1,4}/g).join('-');

// The 25-byte raw form of the testnet account address, hex-encoded.
const rawTestnetAddress = '98E08CABCBA3B0FFD6EFCC57053EDCCE83964AA0AE3BF172A3';

// Helpers

// Builds the public-account projection the account builders return, omitting the name and private key.
const toPublicAccount = (account, { withOptionals = false } = {}) => {
	const publicAccount = {
		address: account.address,
		publicKey: account.publicKey,
		networkIdentifier: account.networkIdentifier
	};

	if (withOptionals) {
		publicAccount.accountType = account.accountType;
		publicAccount.index = account.index;
	}

	return publicAccount;
};

// Shared cases for the key-validation predicates (isPrivateKey, isPublicKey).
const invalidKeyCases = [
	{
		description: 'returns false for a non-key string',
		config: { input: 'invalid' },
		expected: { result: false }
	},
	{
		description: 'returns false for non-string inputs',
		config: { inputs: nonStringInputs },
		expected: { result: false }
	}
];

const runKeyValidationTest = (predicate, description, config, expected) => {
	it(description, () => {
		// Arrange:
		const inputs = config.inputs ?? [config.input];

		// Act & Assert:
		inputs.forEach(input => expect(predicate(input)).toBe(expected.result));
	});
};

describe('utils/account', () => {
	describe('generateKeyPair', () => {
		it('generates a random pair of valid private and public keys', () => {
			// Act:
			const result = generateKeyPair();

			// Assert:
			expect(result.privateKey).toHaveLength(KEY_LENGTH);
			expect(isPrivateKey(result.privateKey)).toBe(true);
			expect(result.publicKey).toHaveLength(KEY_LENGTH);
			expect(isPublicKey(result.publicKey)).toBe(true);
		});
	});

	describe('publicAccountFromPublicKey', () => {
		const runPublicAccountFromPublicKeyTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { account, optionalArgs } = config;

				// Act:
				const result = publicAccountFromPublicKey(account.publicKey, account.networkIdentifier, ...optionalArgs);

				// Assert:
				expect(result).toStrictEqual(expected.account);
			});
		};

		const publicAccountFromPublicKeyTests = [
			{
				description: 'creates a testnet public account from a public key',
				config: { account: testnetAccount, optionalArgs: [] },
				expected: { account: toPublicAccount(testnetAccount) }
			},
			{
				description: 'creates a mainnet public account from a public key',
				config: { account: mainnetAccount, optionalArgs: [] },
				expected: { account: toPublicAccount(mainnetAccount) }
			},
			{
				description: 'includes the account type and index when they are provided',
				config: { account: testnetAccount, optionalArgs: [testnetAccount.accountType, testnetAccount.index] },
				expected: { account: toPublicAccount(testnetAccount, { withOptionals: true }) }
			}
		];

		publicAccountFromPublicKeyTests.forEach(test => runPublicAccountFromPublicKeyTest(test.description, test.config, test.expected));
	});

	describe('publicAccountFromPrivateKey', () => {
		const runPublicAccountFromPrivateKeyTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { account, optionalArgs } = config;

				// Act:
				const result = publicAccountFromPrivateKey(account.privateKey, account.networkIdentifier, ...optionalArgs);

				// Assert:
				expect(result).toStrictEqual(expected.account);
			});
		};

		const publicAccountFromPrivateKeyTests = [
			{
				description: 'creates a testnet public account from a private key',
				config: { account: testnetAccount, optionalArgs: [] },
				expected: { account: toPublicAccount(testnetAccount) }
			},
			{
				description: 'creates a mainnet public account from a private key',
				config: { account: mainnetAccount, optionalArgs: [] },
				expected: { account: toPublicAccount(mainnetAccount) }
			},
			{
				description: 'includes the account type and index when they are provided',
				config: { account: testnetAccount, optionalArgs: [testnetAccount.accountType, testnetAccount.index] },
				expected: { account: toPublicAccount(testnetAccount, { withOptionals: true }) }
			}
		];

		publicAccountFromPrivateKeyTests.forEach(test => runPublicAccountFromPrivateKeyTest(test.description, test.config, test.expected));
	});

	describe('createPrivateAccount', () => {
		it('creates a private account that includes the private key', () => {
			// Arrange:
			const expectedAccount = {
				...toPublicAccount(testnetAccount, { withOptionals: true }),
				privateKey: testnetAccount.privateKey
			};

			// Act:
			const result = createPrivateAccount(
				testnetAccount.privateKey,
				testnetAccount.networkIdentifier,
				testnetAccount.accountType,
				testnetAccount.index
			);

			// Assert:
			expect(result).toStrictEqual(expectedAccount);
		});
	});

	describe('createWalletAccount', () => {
		it('creates a wallet account with a name and account type and without the private key', () => {
			// Arrange:
			const expectedAccount = {
				...toPublicAccount(testnetAccount, { withOptionals: true }),
				name: testnetAccount.name
			};

			// Act:
			const result = createWalletAccount(
				testnetAccount.privateKey,
				testnetAccount.networkIdentifier,
				testnetAccount.name,
				testnetAccount.accountType,
				testnetAccount.index
			);

			// Assert:
			expect(result).toStrictEqual(expectedAccount);
		});
	});

	describe('addressFromPrivateKey', () => {
		const runAddressFromPrivateKeyTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { account } = config;

				// Act:
				const result = addressFromPrivateKey(account.privateKey, account.networkIdentifier);

				// Assert:
				expect(result).toBe(expected.address);
			});
		};

		const addressFromPrivateKeyTests = [
			{
				description: 'derives a testnet address from a private key',
				config: { account: testnetAccount },
				expected: { address: testnetAccount.address }
			},
			{
				description: 'derives a mainnet address from a private key',
				config: { account: mainnetAccount },
				expected: { address: mainnetAccount.address }
			}
		];

		addressFromPrivateKeyTests.forEach(test => runAddressFromPrivateKeyTest(test.description, test.config, test.expected));
	});

	describe('addressFromPublicKey', () => {
		const runAddressFromPublicKeyTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { account } = config;

				// Act:
				const result = addressFromPublicKey(account.publicKey, account.networkIdentifier);

				// Assert:
				expect(result).toBe(expected.address);
			});
		};

		const addressFromPublicKeyTests = [
			{
				description: 'derives a testnet address from a public key',
				config: { account: testnetAccount },
				expected: { address: testnetAccount.address }
			},
			{
				description: 'derives a mainnet address from a public key',
				config: { account: mainnetAccount },
				expected: { address: mainnetAccount.address }
			}
		];

		addressFromPublicKeyTests.forEach(test => runAddressFromPublicKeyTest(test.description, test.config, test.expected));
	});

	describe('addressFromRaw', () => {
		it('converts a raw hex-encoded address to a NEM address', () => {
			// Arrange:
			const expectedAddress = testnetAccount.address;

			// Act:
			const result = addressFromRaw(rawTestnetAddress);

			// Assert:
			expect(result).toBe(expectedAddress);
		});
	});

	describe('normalizeAddress', () => {
		const runNormalizeAddressTest = (description, config) => {
			it(description, () => {
				// Arrange:
				const expectedAddress = testnetAccount.address;

				// Act:
				const result = normalizeAddress(config.input);

				// Assert:
				expect(result).toBe(expectedAddress);
			});
		};

		const normalizeAddressTests = [
			{
				description: 'strips dashes and uppercases a dash-formatted address',
				config: { input: dashedTestnetAddress }
			},
			{
				description: 'uppercases a lowercase address',
				config: { input: testnetAccount.address.toLowerCase() }
			},
			{
				description: 'returns an already normalized address unchanged',
				config: { input: testnetAccount.address }
			}
		];

		normalizeAddressTests.forEach(test => runNormalizeAddressTest(test.description, test.config));

		it('throws a TypeError when the address is not a string', () => {
			// Act & Assert:
			nonStringInputs.forEach(input => expect(() => normalizeAddress(input)).toThrow(TypeError));
		});
	});

	describe('isPrivateKey', () => {
		const isPrivateKeyTests = [
			{
				description: 'returns true for a valid private key',
				config: { input: testnetAccount.privateKey },
				expected: { result: true }
			},
			...invalidKeyCases
		];

		isPrivateKeyTests.forEach(test => runKeyValidationTest(isPrivateKey, test.description, test.config, test.expected));
	});

	describe('isPublicKey', () => {
		const isPublicKeyTests = [
			{
				description: 'returns true for a valid public key',
				config: { input: testnetAccount.publicKey },
				expected: { result: true }
			},
			...invalidKeyCases
		];

		isPublicKeyTests.forEach(test => runKeyValidationTest(isPublicKey, test.description, test.config, test.expected));
	});

	describe('isNemAddress', () => {
		const runIsNemAddressTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const inputs = config.inputs ?? [config.input];

				// Act & Assert:
				inputs.forEach(input => expect(isNemAddress(input, config.networkIdentifier)).toBe(expected.result));
			});
		};

		const isNemAddressTests = [
			{
				description: 'returns true for a valid testnet address',
				config: { input: testnetAccount.address },
				expected: { result: true }
			},
			{
				description: 'returns true for a valid mainnet address',
				config: { input: mainnetAccount.address },
				expected: { result: true }
			},
			{
				description: 'returns true when the address matches the provided network',
				config: { input: testnetAccount.address, networkIdentifier: NetworkIdentifier.TEST_NET },
				expected: { result: true }
			},
			{
				description: 'returns false when the address does not match the provided network',
				config: { input: testnetAccount.address, networkIdentifier: NetworkIdentifier.MAIN_NET },
				expected: { result: false }
			},
			{
				description: 'returns false when the provided network identifier is unknown',
				config: { input: testnetAccount.address, networkIdentifier: 'UNKNOWN_NETWORK' },
				expected: { result: false }
			},
			{
				description: 'returns false for a non-address string',
				config: { input: 'invalid' },
				expected: { result: false }
			},
			{
				description: 'returns false for non-string inputs',
				config: { inputs: nonStringInputs },
				expected: { result: false }
			}
		];

		isNemAddressTests.forEach(test => runIsNemAddressTest(test.description, test.config, test.expected));
	});
});
