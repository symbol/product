import {
    extractAccountSymbolQR,
    extractAddressSymbolQR,
    extractContactSymbolQR,
    extractMnemonicSymbolQR,
    extractTransactionSymbolQR,
} from '@/app/utils/qr';
import { currentNetworkIdentifier, walletStorageAccounts } from '__fixtures__/local/wallet';
import { networkProperties } from '__fixtures__/local/network';

describe('utils/qr', () => {
    const runExtractQRTest = (functionToTest, data, expectedResult) => {
        // Arrange:
        const qrData = {
            generationHash: networkProperties.generationHash,
            networkIdentifier: networkProperties.networkIdentifier,
            v: 3,
            type: 99,
            data,
        };
        const extendedExpectedResult = {
            generationHash: networkProperties.generationHash,
            networkIdentifier: networkProperties.networkIdentifier,
            type: 99,
            ...expectedResult,
        };

        // Act:
        const result = functionToTest(qrData);

        // Assert:
        expect(result).toStrictEqual(extendedExpectedResult);
    };

    describe('extractContactSymbolQR', () => {
        it('extracts data from contact QR code', () => {
            // Arrange:
            const data = {
                name: 'Alice',
                publicKey: walletStorageAccounts[currentNetworkIdentifier][0].publicKey,
            };
            const expectedResult = {
                ...data,
                address: walletStorageAccounts[currentNetworkIdentifier][0].address,
            };

            // Act & Assert:
            runExtractQRTest(extractContactSymbolQR, data, expectedResult);
        });
    });

    describe('extractAccountSymbolQR', () => {
        it('extracts data from account QR code', () => {
            // Arrange:
            const data = {
                privateKey: walletStorageAccounts[currentNetworkIdentifier][0].privateKey,
            };
            const expectedResult = {
                ...data,
                publicKey: walletStorageAccounts[currentNetworkIdentifier][0].publicKey,
                address: walletStorageAccounts[currentNetworkIdentifier][0].address,
            };

            // Act & Assert:
            runExtractQRTest(extractAccountSymbolQR, data, expectedResult);
        });
    });

    describe('extractTransactionSymbolQR', () => {
        it('extracts data from transaction QR code', () => {
            // Arrange:
            const data = {
                payload: 'some-payload',
            };
            const expectedResult = {
                transactionPayload: data.payload,
            };

            // Act & Assert:
            runExtractQRTest(extractTransactionSymbolQR, data, expectedResult);
        });
    });

    describe('extractMnemonicSymbolQR', () => {
        it('extracts data from mnemonic QR code', () => {
            // Arrange:
            const data = {
                plainMnemonic: 'some mnemonic',
            };
            const expectedResult = {
                mnemonic: data.plainMnemonic,
            };

            // Act & Assert:
            runExtractQRTest(extractMnemonicSymbolQR, data, expectedResult);
        });
    });

    describe('extractAddressSymbolQR', () => {
        it('extracts data from address QR code', () => {
            // Arrange:
            const data = {
                name: 'Alice',
                address: walletStorageAccounts[currentNetworkIdentifier][0].address,
            };
            const expectedResult = {
                ...data,
            };

            // Act & Assert:
            runExtractQRTest(extractAddressSymbolQR, data, expectedResult);
        });
    });
});
