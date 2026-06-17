import { TransactionType } from '../../src/constants';
import { transactionToEthereum } from '../../src/utils/transaction-to-ethereum';
import {
	erc20ApproveEthereumTransaction,
	erc20ApproveTransaction,
	erc20BridgeTransferEthereumTransaction,
	erc20BridgeTransferTransaction,
	erc20TransferEthereumTransaction,
	erc20TransferTransaction,
	transferEthereumTransaction,
	transferTransaction,
	uniswapNativeSwapEthereumTransaction,
	uniswapNativeSwapTransaction,
	uniswapSwapEthereumTransaction,
	uniswapSwapTransaction
} from '../__fixtures__/local/transactions';
import { currentNetworkIdentifier } from '../__fixtures__/local/wallet';

// Constants

const networkIdentifier = currentNetworkIdentifier;

describe('utils/transaction-to-ethereum', () => {
	describe('transactionToEthereum', () => {
		const runTransactionToEthereumTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = transactionToEthereum(config.transaction, { networkIdentifier });

				// Assert:
				expect(result).toStrictEqual(expected.ethereumTransaction);
			});
		};

		const transactionToEthereumTests = [
			{
				description: 'converts a native ETH transfer',
				config: { transaction: transferTransaction },
				expected: { ethereumTransaction: transferEthereumTransaction }
			},
			{
				description: 'converts an ERC-20 token transfer',
				config: { transaction: erc20TransferTransaction },
				expected: { ethereumTransaction: erc20TransferEthereumTransaction }
			},
			{
				description: 'converts an ERC-20 bridge transfer by appending the message payload',
				config: { transaction: erc20BridgeTransferTransaction },
				expected: { ethereumTransaction: erc20BridgeTransferEthereumTransaction }
			},
			{
				description: 'converts a Uniswap swap with an ERC-20 source token',
				config: { transaction: uniswapSwapTransaction },
				expected: { ethereumTransaction: uniswapSwapEthereumTransaction }
			},
			{
				description: 'converts a Uniswap swap with a native ETH source token by wrapping it',
				config: { transaction: uniswapNativeSwapTransaction },
				expected: { ethereumTransaction: uniswapNativeSwapEthereumTransaction }
			},
			{
				description: 'converts an ERC-20 approval',
				config: { transaction: erc20ApproveTransaction },
				expected: { ethereumTransaction: erc20ApproveEthereumTransaction }
			}
		];

		transactionToEthereumTests.forEach(test => runTransactionToEthereumTest(test.description, test.config, test.expected));

		it('returns null for an unsupported transaction type', () => {
			// Arrange:
			const transaction = { type: TransactionType.RESERVED };

			// Act:
			const result = transactionToEthereum(transaction, { networkIdentifier });

			// Assert:
			expect(result).toBeNull();
		});

		it('omits the gas fields when the transaction has no fee', () => {
			// Arrange:
			const transaction = { ...transferTransaction };
			delete transaction.fee;

			// Act:
			const result = transactionToEthereum(transaction, { networkIdentifier });

			// Assert:
			expect(result).not.toHaveProperty('gasLimit');
			expect(result).not.toHaveProperty('maxFeePerGas');
			expect(result).not.toHaveProperty('maxPriorityFeePerGas');
		});
	});
});
