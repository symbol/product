import { SymbolQR } from '@/app/lib/features/SymbolQR';
import { networkProperties } from '__fixtures__/local/network';
import { currentAccount } from '__fixtures__/local/wallet';

const QR_TYPE = {
    Contact: 1,
    Account: 2,
    Transaction: 3,
    Mnemonic: 5,
    Address: 7,
};
const QR_VERSION = 3;

describe('SymbolQR', () => {
    describe('constructor', () => {
        describe('creates an instance for', () => {
            const runConstructorTest = (type, data) => {
                // Act:
                const qr = new SymbolQR(type, data, networkProperties);

                // Assert:
                expect(qr.data).toStrictEqual(data);
                expect(qr.version).toBe(QR_VERSION);
                expect(qr.type).toBe(type);
                expect(qr.generationHash).toBe(networkProperties.generationHash);
                expect(qr.networkIdentifier).toBe(networkProperties.networkIdentifier);
            };

            it('Contact', () => {
                // Arrange:
                const data = { name: currentAccount.name, publicKey: currentAccount.publicKey };

                // Act & Assert:
                runConstructorTest(QR_TYPE.Contact, data);
            });

            it('Account', () => {
                // Arrange:
                const data = { privateKey: currentAccount.privateKey };

                // Act & Assert:
                runConstructorTest(QR_TYPE.Account, data);
            });

            it('Transaction', () => {
                // Arrange:
                const data = { payload: 'some transaction payload' };

                // Act & Assert:
                runConstructorTest(QR_TYPE.Transaction, data);
            });

            it('Mnemonic', () => {
                // Arrange:
                const data = { plainMnemonic: 'some mnemonic' };

                // Act & Assert:
                runConstructorTest(QR_TYPE.Mnemonic, data);
            });

            it('Address', () => {
                // Arrange:
                const data = { name: currentAccount.name, address: currentAccount.address };

                // Act & Assert:
                runConstructorTest(QR_TYPE.Address, data);
            });
        });

        describe('throws an error when', () => {
            const runConstructorErrorTest = (type, data, expectedErrorMessage) => {
                // Act & Assert:
                expect(() => new SymbolQR(type, data, networkProperties)).toThrow(expectedErrorMessage);
            };

            it('QR type is unsupported', () => {
                // Arrange:
                const type = 999;
                const data = { name: currentAccount.name, publicKey: currentAccount.publicKey };
                const expectedErrorMessage = `Unsupported Symbol QR type: "${type}"`;

                // Act & Assert:
                runConstructorErrorTest(type, data, expectedErrorMessage);
            });

            it('required parameter is missing', () => {
                // Arrange:
                const type = QR_TYPE.Contact;
                const data = { publicKey: currentAccount.publicKey };
                const expectedErrorMessage = `Missing required parameter "name" for QR type "${type}"`;

                // Act & Assert:
                runConstructorErrorTest(type, data, expectedErrorMessage);
            });

            it('unknown parameter is present', () => {
                // Arrange:
                const type = QR_TYPE.Contact;
                const data = { name: currentAccount.name, publicKey: currentAccount.publicKey, unknown: 'foo' };
                const expectedErrorMessage = `Unknown parameter "unknown" for QR type "${type}"`;

                // Act & Assert:
                runConstructorErrorTest(type, data, expectedErrorMessage);
            });
        });
    });

    it('converts to transport string correctly', () => {
        // Arrange:
        const data = { name: currentAccount.name, publicKey: currentAccount.publicKey };

        // Act:
        const qr = new SymbolQR(QR_TYPE.Contact, data, networkProperties);
        const transportString = qr.toTransportString();

        // Assert:
        expect(transportString).toBe(
            JSON.stringify({
                v: QR_VERSION,
                type: QR_TYPE.Contact,
                network_id: 152,
                chain_id: networkProperties.generationHash,
                data: data,
            })
        );
    });

    it('converts to JSON correctly', () => {
        // Arrange:
        const data = { name: currentAccount.name, publicKey: currentAccount.publicKey };

        // Act:
        const qr = new SymbolQR(QR_TYPE.Contact, data, networkProperties);
        const json = qr.toJSON();

        // Assert:
        expect(json).toEqual({
            version: QR_VERSION,
            type: QR_TYPE.Contact,
            networkIdentifier: networkProperties.networkIdentifier,
            generationHash: networkProperties.generationHash,
            data: data,
        });
    });

    it('generates a base64-encoded QR code', async () => {
        // Arrange:
        const data = { name: currentAccount.name, publicKey: currentAccount.publicKey };

        // Act:
        const qr = new SymbolQR(QR_TYPE.Contact, data, networkProperties);
        const base64 = await qr.toBase64();

        // Assert:
        expect(base64).toMatch(/^data:image\/png;base64,/);
    });

    it('creates instance from transport string', () => {
        // Arrange:
        const data = { name: currentAccount.name, publicKey: currentAccount.publicKey };
        const transportString = JSON.stringify({
            v: QR_VERSION,
            type: QR_TYPE.Contact,
            network_id: 152,
            chain_id: networkProperties.generationHash,
            data: data,
        });

        // Act:
        const qr = SymbolQR.fromTransportString(transportString);

        // Assert:
        expect(qr.version).toBe(QR_VERSION);
        expect(qr.type).toBe(QR_TYPE.Contact);
        expect(qr.networkIdentifier).toBe(networkProperties.networkIdentifier);
        expect(qr.generationHash).toBe(networkProperties.generationHash);
        expect(qr.data).toEqual(data);
    });
});
