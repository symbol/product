import { createStorageMock } from './storage';
import { ProtocolSdk } from '../../src/lib/ProtocolSdk';
import { externalKeystoreAccounts, mnemonic, networkIdentifiers } from '../fixtures/wallet';
import { jest } from '@jest/globals';

export const runBaseSoftwareKeystoreTest = Keystore => {
	let sdk;
	let keystore;

	beforeEach(() => {
		const secureStorageInterface = createStorageMock({});
		sdk = new ProtocolSdk({
			signTransaction: jest.fn().mockResolvedValue('signed-transaction'),
			cosignTransaction: jest.fn().mockResolvedValue('cosigned-transaction'),
			encryptMessage: jest.fn().mockResolvedValue('encrypted-message'),
			decryptMessage: jest.fn().mockResolvedValue('decrypted-message'),
			createPrivateAccount: jest.fn().mockResolvedValue('private-account'),
			createPrivateKeysFromMnemonic: jest.fn().mockResolvedValue(['private-key'])
		});
		keystore = new Keystore({ secureStorageInterface, sdk, networkIdentifiers });
		keystore._state = {
			mnemonic,
			privateAccounts: externalKeystoreAccounts
		};
	});

	describe('getAccounts()', () => {
		it('returns accounts from the keystore state', async () => {
			// Arrange:
			const expectedResult = {
				/* eslint-disable-next-line no-unused-vars */
				testnet: externalKeystoreAccounts.testnet.map(({ privateKey, ...rest }) => ({
					...rest
				})),
				/* eslint-disable-next-line no-unused-vars */
				mainnet: externalKeystoreAccounts.mainnet.map(({ privateKey, ...rest }) => ({
					...rest
				}))
			};

			// Act:
			const accounts = await keystore.getAccounts();

			// Assert:
			expect(accounts).toStrictEqual(expectedResult);
		});
	});

	describe('getPrivateKey()', () => {
		it('returns the private key for the specified account', async () => {
			// Arrange:
			const { networkIdentifier, publicKey } = externalKeystoreAccounts.testnet[0];
			const account = { networkIdentifier, publicKey };
			const expectedPrivateKey = externalKeystoreAccounts.testnet[0].privateKey;

			// Act:
			const privateKey = await keystore.getPrivateKey(account);

			// Assert:
			expect(privateKey).toBe(expectedPrivateKey);
		});

		it('throws an error if the account is not found in the keystore', async () => {
			// Arrange:
			const account = { networkIdentifier: 'testnet', publicKey: 'non-existent-key' };

			// Act & Assert:
			await expect(keystore.getPrivateKey(account))
				.rejects.toThrow('Failed to get account private key. Account is missing in the keystore.');
		});
	});

	const runSignatureMethodTest = async (methodName, args, expectedSdkMethodName, expectedSdkMethodArgs, expectedResult) => {
		// Arrange:
		const privateKey = 'private-key';
		jest.spyOn(keystore, 'getPrivateKey').mockResolvedValue(privateKey);

		// Act:
		const result = await keystore[methodName](...args);

		// Assert:
		expect(result).toBe(expectedResult);
		expect(sdk[expectedSdkMethodName]).toHaveBeenCalledWith(...expectedSdkMethodArgs, privateKey);
	};

	const signatureMethodsTestConfig = [
		{
			methodName: 'signTransaction',
			args: ['networkProperties', 'transaction', 'account'],
			expectedSdkMethodName: 'signTransaction',
			expectedSdkMethodArgs: ['networkProperties', 'transaction'],
			expectedResult: 'signed-transaction'
		},
		{
			methodName: 'cosignTransaction',
			args: ['networkProperties', 'transaction', 'account'],
			expectedSdkMethodName: 'cosignTransaction',
			expectedSdkMethodArgs: ['networkProperties', 'transaction'],
			expectedResult: 'cosigned-transaction'
		},
		{
			methodName: 'encryptMessage',
			args: ['message', 'recipientAccount'],
			expectedSdkMethodName: 'encryptMessage',
			expectedSdkMethodArgs: ['message', 'recipientAccount'],
			expectedResult: 'encrypted-message'
		},
		{
			methodName: 'decryptMessage',
			args: ['encryptedMessage', 'senderAccount'],
			expectedSdkMethodName: 'decryptMessage',
			expectedSdkMethodArgs: ['encryptedMessage', 'senderAccount'],
			expectedResult: 'decrypted-message'
		}
	];

	signatureMethodsTestConfig.forEach(({ methodName, args, expectedSdkMethodName, expectedSdkMethodArgs, expectedResult }) => {
		describe(`${methodName}()`, () => {
			it(`calls SDK's ${expectedSdkMethodName} with correct arguments`, async () => {
				await runSignatureMethodTest(methodName, args, expectedSdkMethodName, expectedSdkMethodArgs, expectedResult);
			});
		});
	});
};
