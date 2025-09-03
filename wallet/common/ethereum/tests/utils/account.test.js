import {
	addressFromPrivateKey,
	addressFromPublicKey,
	createPrivateAccount,
	createWalletAccount,
	generateKeyPair,
	isEthereumAddress,
	isPrivateKey,
	isPublicKey,
	publicAccountFromPrivateKey,
	publicAccountFromPublicKey
} from '../../src/utils';
import { currentNetworkIdentifier, walletStorageAccounts } from '../__fixtures__/local/wallet';
import { forEachNetwork } from '../test-utils';


describe('utils/account', () => {
	describe('generateKeyPair', () => {
		it('generates a random key pair', () => {
			// Arrange:
			const privateKeyLength = 66;
			const publicKeyLength = 68;
			// Act:
			const result = generateKeyPair();

			// Assert:
			expect(result).toHaveProperty('privateKey');
			expect(typeof result.privateKey).toBe('string');
			expect(result.privateKey.length).toBe(privateKeyLength);

			expect(result).toHaveProperty('publicKey');
			expect(typeof result.publicKey).toBe('string');
			expect(result.publicKey.length).toBe(publicKeyLength);
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
		const runIsPublicOrPrivateKeyTest = (input, expectedResult) => {
			// Act:
			const result = isPrivateKey(input);

			// Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns true if the input is a private key', () => {
			// Arrange:
			const {privateKey} = walletStorageAccounts[currentNetworkIdentifier][0];
			const expectedResult = true;

			// Act & Assert:
			runIsPublicOrPrivateKeyTest(privateKey, expectedResult);
		});

		it('returns false if the input is not a string', () => {
			// Arrange:
			const inputs = [123, null, undefined, [], {}, () => {}, true];
			const expectedResult = false;

			// Act & Assert:
			inputs.forEach(input => runIsPublicOrPrivateKeyTest(input, expectedResult));
		});

		it('returns false if the input is not a private key', () => {
			// Arrange:
			const input = 'invalid';
			const expectedResult = false;

			// Act & Assert:
			runIsPublicOrPrivateKeyTest(input, expectedResult);
		});
	});

	describe('isPublicKey', () => {
		const runIsPublicKeyTest = (input, expectedResult) => {
			// Act:
			const result = isPublicKey(input);

			// Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns true if the input is a public key', () => {
			// Arrange:
			const {publicKey} = walletStorageAccounts[currentNetworkIdentifier][0];
			const expectedResult = true;

			// Act & Assert:
			runIsPublicKeyTest(publicKey, expectedResult);
		});

		it('returns false if the input is not a string', () => {
			// Arrange:
			const inputs = [123, null, undefined, [], {}, () => {}, true];
			const expectedResult = false;

			// Act & Assert:
			inputs.forEach(input => runIsPublicKeyTest(input, expectedResult));
		});

		it('returns false if the input is not a public key', () => {
			// Arrange:
			const input = 'invalid';
			const expectedResult = false;

			// Act & Assert:
			runIsPublicKeyTest(input, expectedResult);
		});
	});

	describe('isEthereumAddress', () => {
		const runIsEthereumAddressTest = (input, expectedResult) => {
			// Act:
			const result = isEthereumAddress(input);

			// Assert:
			expect(result).toBe(expectedResult);
		};

		it('returns true if the input is a Ethereum address', () => {
			// Arrange:
			const address = '0xb1b2145b7d2ba5AB20Ee0Bcb0F7FAd08a1BfC7A4';
			const expectedResult = true;

			// Act & Assert:
			runIsEthereumAddressTest(address, expectedResult);
		});

		it('returns false if the input is not a string', () => {
			// Arrange:
			const inputs = [123, null, undefined, [], {}, () => {}, true];
			const expectedResult = false;

			// Act & Assert:
			inputs.forEach(input => runIsEthereumAddressTest(input, expectedResult));
		});

		it('returns false if the input is not a Ethereum address', () => {
			// Arrange:
			const input = 'invalid';
			const expectedResult = false;

			// Act & Assert:
			runIsEthereumAddressTest(input, expectedResult);
		});
	});
});
