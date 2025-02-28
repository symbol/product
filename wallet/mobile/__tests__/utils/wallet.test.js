import { createOptInPrivateKeyFromMnemonic, createPrivateKeysFromMnemonic, generateMnemonic } from '@/app/utils';
import { mnemonic, networkIdentifiers, walletStorageAccounts } from '__fixtures__/local/wallet';

const OPT_IN_PRIVATE_KEY = '8965375F47E64529E6FBBB968764ED8DE64A0973701ABDEEF91A56CA626604B7';
const OPT_IN_PUBLIC_KEY = '98D11F7EF395131E5CDF5EC0F9105145A56FB337DC6699F7B652AB393E90003B';

jest.mock('@/app/config', () => ({
    ...jest.requireActual('@/app/config'),
    optInWhiteList: [OPT_IN_PUBLIC_KEY],
}));

describe('utils/wallet', () => {
    describe('generateMnemonic', () => {
        it('generates a random mnemonic phrase string of 24 words', () => {
            // Arrange:
            const expectedWordsCount = 24;

            // Act:
            const result = generateMnemonic();
            const mnemonicWords = result.split(' ');

            // Assert:
            expect(typeof result).toBe('string');
            expect(mnemonicWords.length).toBe(expectedWordsCount);
        });
    });

    describe('createPrivateKeysFromMnemonic', () => {
        it('derives private keys from a given mnemonic phrase', () => {
            networkIdentifiers.forEach((networkIdentifier) => {
                // Arrange:
                const indexes = [0, 1, 2, 3, 4];
                const expectedPrivateKeys = walletStorageAccounts[networkIdentifier].map((account) => account.privateKey);

                // Act:
                const result = createPrivateKeysFromMnemonic(mnemonic, indexes, networkIdentifier);

                // Assert:
                expect(result).toEqual(expectedPrivateKeys);
            });
        });
    });

    describe('createOptInPrivateKeyFromMnemonic', () => {
        const runTest = (mnemonic, expectedResult) => {
            // Act:
            const result = createOptInPrivateKeyFromMnemonic(mnemonic);

            // Assert:
            expect(result).toBe(expectedResult);
        };

        it('derives private key from a given mnemonic phrase using the opt-in curve', () => {
            // Arrange:
            const expectedResult = OPT_IN_PRIVATE_KEY;

            // Act & Assert:
            runTest(mnemonic, expectedResult);
        });

        it('returns null if the is no public key match in the opt-in white list', () => {
            // Arrange:
            const mnemonic =
                'pizza road phone chase web cancel release hand mail engine custom pole damp envelope fame topple patch asset attract purse venture clay elevator program';
            const expectedResult = null;

            // Act & Assert:
            runTest(mnemonic, expectedResult);
        });
    });
});
