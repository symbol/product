import {
    addressFromPrivateKey,
    addressFromPublicKey,
    addressFromRaw,
    createWalletAccount,
    createWalletStorageAccount,
    generateKeyPair,
    isPublicOrPrivateKey,
    isSymbolAddress,
    publicAccountFromPrivateKey,
    publicAccountFromPublicKey,
} from '@/app/utils/account';
import { walletStorageAccounts } from '__fixtures__/local/wallet';
import { forEachNetwork } from '../test-utils';

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
                    networkIdentifier,
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
                    networkIdentifier,
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
                    index: account.index,
                };

                // Act:
                const result = createWalletAccount(account.privateKey, networkIdentifier, account.name, account.accountType, account.index);

                // Assert:
                expect(result).toStrictEqual(expectedResult);
            });
        });
    });

    describe('createWalletStorageAccount', () => {
        it('creates wallet account object which contains private key', () => {
            forEachNetwork(walletStorageAccounts, (networkIdentifier, account) => {
                // Arrange:
                const expectedResult = {
                    address: account.address,
                    publicKey: account.publicKey,
                    name: account.name,
                    networkIdentifier,
                    accountType: account.accountType,
                    index: account.index,
                    privateKey: account.privateKey,
                };

                // Act:
                const result = createWalletStorageAccount(
                    account.privateKey,
                    networkIdentifier,
                    account.name,
                    account.accountType,
                    account.index
                );

                // Assert:
                expect(result).toStrictEqual(expectedResult);
            });
        });
    });

    describe('isPublicOrPrivateKey', () => {
        const runIsPublicOrPrivateKeyTest = (input, expectedResult) => {
            // Act:
            const result = isPublicOrPrivateKey(input);

            // Assert:
            expect(result).toBe(expectedResult);
        };

        it('returns true if the input is a public or private key', () => {
            // Arrange:
            const publicKey = 'F94C017383A5FE74B5AB56B9EA09534E9C7F4DF299A80428C883B8124B60B710';
            const expectedResult = true;

            // Act & Assert:
            runIsPublicOrPrivateKeyTest(publicKey, expectedResult);
        });

        it('returns false if the input is not a string', () => {
            // Arrange:
            const inputs = [123, null, undefined, [], {}, () => {}, true];
            const expectedResult = false;

            // Act & Assert:
            inputs.forEach((input) => runIsPublicOrPrivateKeyTest(input, expectedResult));
        });

        it('returns false if the input is not a public or private key', () => {
            // Arrange:
            const input = 'invalid';
            const expectedResult = false;

            // Act & Assert:
            runIsPublicOrPrivateKeyTest(input, expectedResult);
        });
    });

    describe('isSymbolAddress', () => {
        const runIsSymbolAddressTest = (input, expectedResult) => {
            // Act:
            const result = isSymbolAddress(input);

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
            inputs.forEach((input) => runIsSymbolAddressTest(input, expectedResult));
        });

        it('returns false if the input is not a Symbol address', () => {
            // Arrange:
            const input = 'invalid';
            const expectedResult = false;

            // Act & Assert:
            runIsSymbolAddressTest(input, expectedResult);
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
});
