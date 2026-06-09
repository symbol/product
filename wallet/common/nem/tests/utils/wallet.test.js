import { NetworkIdentifier } from '../../src/constants';
import { createPrivateKeysFromMnemonic, generateMnemonic } from '../../src/utils';
import { mnemonic, walletStorageAccounts } from '../__fixtures__/local/wallet';

// Constants

const MNEMONIC_WORD_COUNT = 24;
const accountIndexes = [0, 1, 2, 3, 4];

describe('utils/wallet', () => {
	describe('generateMnemonic', () => {
		it('generates a random 24-word mnemonic phrase', () => {
			// Act:
			const result = generateMnemonic();

			// Assert:
			expect(typeof result).toBe('string');
			expect(result.split(' ')).toHaveLength(MNEMONIC_WORD_COUNT);
		});
	});

	describe('createPrivateKeysFromMnemonic', () => {
		const runCreatePrivateKeysFromMnemonicTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createPrivateKeysFromMnemonic(mnemonic, accountIndexes, config.networkIdentifier);

				// Assert:
				expect(result).toStrictEqual(expected.privateKeys);
			});
		};

		const createPrivateKeysFromMnemonicTests = [
			{
				description: 'derives the mainnet private keys for the given indexes',
				config: { networkIdentifier: NetworkIdentifier.MAIN_NET },
				expected: { privateKeys: walletStorageAccounts[NetworkIdentifier.MAIN_NET].map(account => account.privateKey) }
			},
			{
				description: 'derives the testnet private keys for the given indexes',
				config: { networkIdentifier: NetworkIdentifier.TEST_NET },
				expected: { privateKeys: walletStorageAccounts[NetworkIdentifier.TEST_NET].map(account => account.privateKey) }
			}
		];

		createPrivateKeysFromMnemonicTests.forEach(test =>
			runCreatePrivateKeysFromMnemonicTest(test.description, test.config, test.expected));
	});
});
