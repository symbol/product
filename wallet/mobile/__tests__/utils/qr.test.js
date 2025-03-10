import { createSymbolQR, parseSymbolQR } from '@/app/utils/qr';
import { currentNetworkIdentifier, walletStorageAccounts } from '__fixtures__/local/wallet';
import { networkProperties } from '__fixtures__/local/network';

describe('utils/qr', () => {
    describe('createSymbolQR', () => {
        const runCreateSymbolQRTest = (type, data, expectedResult) => {
            // Act:
            const result = createSymbolQR(type, data, networkProperties);

            // Assert:
            expect(result).toStrictEqual(expectedResult);
        };
        const baseResult = {
            chain_id: '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4',
            network_id: 152,
            v: 3,
        };

        it('creates contact QR code', () => {
            // Arrange:
            const type = 1;
            const data = {
                name: 'Alice',
                publicKey: walletStorageAccounts[currentNetworkIdentifier][0].publicKey,
            };
            const expectedResult = {
                ...baseResult,
                type,
                data,
            };

            // Act & Assert:
            runCreateSymbolQRTest(type, data, expectedResult);
        });

        it('creates account QR code', () => {
            // Arrange:
            const type = 2;
            const data = {
                privateKey: walletStorageAccounts[currentNetworkIdentifier][0].privateKey,
            };
            const expectedResult = {
                ...baseResult,
                type,
                data,
            };

            // Act & Assert:
            runCreateSymbolQRTest(type, data, expectedResult);
        });

        it('creates transaction QR code', () => {
            // Arrange:
            const type = 3;
            const data = {
                payload: 'payload',
            };
            const expectedResult = {
                ...baseResult,
                type,
                data,
            };

            // Act & Assert:
            runCreateSymbolQRTest(type, data, expectedResult);
        });

        it('creates mnemonic QR code', () => {
            // Arrange:
            const type = 5;
            const data = {
                mnemonic: 'mnemonic',
            };
            const expectedResult = {
                ...baseResult,
                type,
                data,
            };

            // Act & Assert:
            runCreateSymbolQRTest(type, data, expectedResult);
        });

        it('creates address QR code', () => {
            // Arrange:
            const type = 7;
            const data = {
                name: 'Alice',
                address: walletStorageAccounts[currentNetworkIdentifier][0].address,
            };
            const expectedResult = {
                ...baseResult,
                type,
                data,
            };

            // Act & Assert:
            runCreateSymbolQRTest(type, data, expectedResult);
        });
    });

    describe('parseSymbolQR', () => {
        const runParseSymbolQRTest = (type, data, expectedResult) => {
            // Act:
            const result = parseSymbolQR({
                v: 3,
                type,
                network_id: 152,
                chain_id: '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4',
                data,
            });

            // Assert:
            expect(result).toStrictEqual(expectedResult);
        };

        const baseResult = {
            generationHash: '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4',
            networkIdentifier: currentNetworkIdentifier,
        };

        it('parses contact QR code', () => {
            // Arrange:
            const type = 1;
            const data = {
                name: 'Alice',
                publicKey: walletStorageAccounts[currentNetworkIdentifier][0].publicKey,
            };
            const expectedResult = {
                ...baseResult,
                type,
                name: 'Alice',
                publicKey: walletStorageAccounts[currentNetworkIdentifier][0].publicKey,
            };

            // Act & Assert:
            runParseSymbolQRTest(type, data, expectedResult);
        });

        it('parses account QR code', () => {
            // Arrange:
            const type = 2;
            const data = {
                privateKey: walletStorageAccounts[currentNetworkIdentifier][0].privateKey,
            };
            const expectedResult = {
                ...baseResult,
                type,
                privateKey: walletStorageAccounts[currentNetworkIdentifier][0].privateKey,
            };

            // Act & Assert:
            runParseSymbolQRTest(type, data, expectedResult);
        });

        it('parses transaction QR code', () => {
            // Arrange:
            const type = 3;
            const data = {
                payload: 'payload',
            };
            const expectedResult = {
                ...baseResult,
                type,
                payload: 'payload',
            };

            // Act & Assert:
            runParseSymbolQRTest(type, data, expectedResult);
        });

        it('parses mnemonic QR code', () => {
            // Arrange:
            const type = 5;
            const data = {
                mnemonic: 'mnemonic',
            };
            const expectedResult = {
                ...baseResult,
                type,
                mnemonic: 'mnemonic',
            };

            // Act & Assert:
            runParseSymbolQRTest(type, data, expectedResult);
        });

        it('parses address QR code', () => {
            // Arrange:
            const type = 7;
            const data = {
                name: 'Alice',
                address: walletStorageAccounts[currentNetworkIdentifier][0].address,
            };
            const expectedResult = {
                ...baseResult,
                type,
                name: 'Alice',
                address: walletStorageAccounts[currentNetworkIdentifier][0].address,
            };

            // Act & Assert:
            runParseSymbolQRTest(type, data, expectedResult);
        });
    });
});
