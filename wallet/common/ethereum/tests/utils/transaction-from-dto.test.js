import { TransactionType } from '../../src/constants';
import { getUnresolvedIdsFromTransactionDTOs, transactionFromDTO } from '../../src/utils';
import {
	bridgeTransactionResponse,
	erc20TransactionResponse,
	etherTransactionResponse,
	transactionResponses
} from '../__fixtures__/api/transaction';
import { blocks } from '../__fixtures__/local/block';
import { networkProperties } from '../__fixtures__/local/network';
import { tokenInfos } from '../__fixtures__/local/token';
import {
	bridgeTransaction,
	erc20Transaction,
	etherTransaction
} from '../__fixtures__/local/transactions';
import { currentAccount } from '../__fixtures__/local/wallet';

// Constants

// Shared config consumed by every transactionFromDTO call.
const transactionOptions = {
	networkProperties,
	currentAccount,
	tokenInfos,
	blocks
};

describe('utils/transaction-from-dto', () => {
	describe('transactionFromDTO', () => {
		const runTransactionFromDTOTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = transactionFromDTO(config.transactionDTO, transactionOptions);

				// Assert:
				expect(result).toStrictEqual(expected.transaction);
			});
		};

		const transactionFromDTOTests = [
			{
				description: 'maps a native ETH transfer',
				config: { transactionDTO: etherTransactionResponse },
				expected: { transaction: etherTransaction }
			},
			{
				description: 'maps an ERC-20 token transfer',
				config: { transactionDTO: erc20TransactionResponse },
				expected: { transaction: erc20Transaction }
			},
			{
				description: 'maps an ERC-20 bridge transfer with a message',
				config: { transactionDTO: bridgeTransactionResponse },
				expected: { transaction: bridgeTransaction }
			}
		];

		transactionFromDTOTests.forEach(test => runTransactionFromDTOTest(test.description, test.config, test.expected));

		it('sets height, nonce and timestamp to null when block metadata is absent', () => {
			// Arrange:
			const transactionDTO = { ...etherTransactionResponse, blockNumber: null, hash: null, nonce: null };

			// Act:
			const result = transactionFromDTO(transactionDTO, transactionOptions);

			// Assert:
			expect(result.height).toBeNull();
			expect(result.hash).toBeNull();
			expect(result.nonce).toBeNull();
			expect(result.timestamp).toBeUndefined();
		});

		it('defaults the transferred amount to zero when the value is absent', () => {
			// Arrange:
			const transactionDTO = { ...etherTransactionResponse, value: undefined };
			const expectedAmount = '0';

			// Act:
			const result = transactionFromDTO(transactionDTO, transactionOptions);

			// Assert:
			expect(result.tokens[0].amount).toBe(expectedAmount);
		});

		it('sets the recipient address to null when the transfer has no recipient', () => {
			// Arrange:
			const transactionDTO = { ...etherTransactionResponse, to: null };

			// Act:
			const result = transactionFromDTO(transactionDTO, transactionOptions);

			// Assert:
			expect(result.recipientAddress).toBeNull();
		});

		it('keeps the ERC-20 transfer type when the trailing call data is all zeros', () => {
			// Arrange: padding the call data with zero bytes must not be treated as a bridge message.
			const transactionDTO = { ...erc20TransactionResponse, input: erc20TransactionResponse.input + '0'.repeat(64) };

			// Act:
			const result = transactionFromDTO(transactionDTO, transactionOptions);

			// Assert:
			expect(result.type).toBe(TransactionType.ERC_20_TRANSFER);
			expect(result.message).toBeUndefined();
		});
	});

	describe('getUnresolvedIdsFromTransactionDTOs', () => {
		it('extracts unique block heights and ERC-20 contract addresses', () => {
			// Arrange: the two ERC-20 DTOs share a contract address, so it must be de-duplicated.
			const expectedResult = {
				blockHeights: ['251023', '251181', '249648'],
				tokenContractAddresses: ['0x5e8343a455f03109b737b6d8b410e4ecce998cda']
			};

			// Act:
			const result = getUnresolvedIdsFromTransactionDTOs(transactionResponses);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
		});

		it('returns empty lists when no DTOs are provided', () => {
			// Act:
			const result = getUnresolvedIdsFromTransactionDTOs([]);

			// Assert:
			expect(result).toStrictEqual({ blockHeights: [], tokenContractAddresses: [] });
		});
	});
});
