import { SymbolTransactionType } from '@/app/constants';
import { CaptionType } from '@/app/screens/history/types/TransactionGraphic';
import { createTransactionGraphicData } from '@/app/screens/history/utils/transaction-graphic';
import { mockLocalization } from '__tests__/mock-helpers';

const SIGNER_ADDRESS = 'NALSBRWZTK3WQEGZ25NO4YH2MOU4SXYY6AVY72I';
const LONG_SECRET = '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF';
const TRUNCATED_SECRET = '01234567...89ABCDEF';

const options = {
	chainName: 'symbol',
	networkIdentifier: 'mainnet',
	walletAccounts: []
};

describe('screens/history/utils/transaction-graphic', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('createTransactionGraphicData', () => {
		const runSecretCaptionTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const transaction = {
					type: config.type,
					signerAddress: SIGNER_ADDRESS,
					secret: LONG_SECRET
				};

				// Act:
				const result = createTransactionGraphicData(transaction, options);

				// Assert:
				expect(result.arrowCaptions).toEqual([
					{ type: CaptionType.TEXT, value: expected.captionValue }
				]);
			});
		};

		const tests = [
			{
				description: 'truncates the secret caption for a secret lock transaction',
				config: { type: SymbolTransactionType.SECRET_LOCK },
				expected: { captionValue: TRUNCATED_SECRET }
			},
			{
				description: 'truncates the secret caption for a secret proof transaction',
				config: { type: SymbolTransactionType.SECRET_PROOF },
				expected: { captionValue: TRUNCATED_SECRET }
			}
		];

		tests.forEach(test => runSecretCaptionTest(test.description, test.config, test.expected));
	});
});
