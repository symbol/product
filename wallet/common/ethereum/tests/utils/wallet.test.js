import { createPrivateKeysFromMnemonic, generateMnemonic } from '../../src/utils';
import { mnemonic, networkIdentifiers, walletStorageAccounts } from '../__fixtures__/local/wallet';

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
			networkIdentifiers.forEach(networkIdentifier => {
				// Arrange:
				const indexes = [0, 1, 2, 3, 4];
				const expectedPrivateKeys = walletStorageAccounts[networkIdentifier].map(account => account.privateKey);

				// Act:
				const result = createPrivateKeysFromMnemonic(mnemonic, indexes, networkIdentifier);

				// Assert:
				expect(result).toEqual(expectedPrivateKeys);
			});
		});
	});
});
