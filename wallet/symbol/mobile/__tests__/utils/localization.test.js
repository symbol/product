import { EthereumTransactionType, ReceiptType, SymbolTransactionType, TransactionDirection } from '@/app/constants';
import en from '@/app/localization/locales/en.json';
import { getErrorMessageLocaleKey, getReceiptTypeLocaleKey, getTransactionTypeLocaleKey } from '@/app/utils';
import { constants } from 'wallet-common-core';

const { ErrorCode } = constants;

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';

const enKeys = Object.keys(en);

describe('utils/localization', () => {
	describe('getErrorMessageLocaleKey()', () => {
		const runGetErrorMessageLocaleKeyTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getErrorMessageLocaleKey(config.code);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const getErrorMessageLocaleKeyTests = [
			{
				description: 'returns the mapped key for the keystore error code',
				config: { code: ErrorCode.KEYSTORE_ERROR },
				expected: { result: 'errorMessage_keystore' }
			},
			{
				description: 'returns the mapped key for the account not found error code',
				config: { code: ErrorCode.WALLET_ACCOUNT_NOT_FOUND },
				expected: { result: 'errorMessage_accountNotFound' }
			},
			{
				description: 'returns the mapped key for a string-literal wallet/common code',
				config: { code: 'error_transfer_unknown_recipient' },
				expected: { result: 'errorMessage_transferUnknownRecipient' }
			},
			{
				description: 'returns the unknown-error key for an unmapped code',
				config: { code: 'error_some_unknown_code' },
				expected: { result: 'errorMessage_unknown' }
			},
			{
				description: 'returns the unknown-error key when the code is undefined',
				config: { code: undefined },
				expected: { result: 'errorMessage_unknown' }
			}
		];

		getErrorMessageLocaleKeyTests.forEach(test => {
			runGetErrorMessageLocaleKeyTest(test.description, test.config, test.expected);
		});

		it('maps every ErrorCode member to an existing en.json key', () => {
			// Act:
			const unknownKeys = Object.values(ErrorCode)
				.map(getErrorMessageLocaleKey)
				.filter(key => !enKeys.includes(key));

			// Assert:
			expect(unknownKeys).toEqual([]);
		});
	});

	describe('getTransactionTypeLocaleKey()', () => {
		const runGetTransactionTypeLocaleKeyTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getTransactionTypeLocaleKey(config.type, config.chainName, config.direction);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const getTransactionTypeLocaleKeyTests = [
			{
				description: 'returns the mapped key for a symbol transaction type',
				config: { type: SymbolTransactionType.HASH_LOCK, chainName: CHAIN_NAME_SYMBOL },
				expected: { result: 'transactionType_hashLock' }
			},
			{
				description: 'returns the plain transfer key for a symbol transfer without direction',
				config: { type: SymbolTransactionType.TRANSFER, chainName: CHAIN_NAME_SYMBOL },
				expected: { result: 'transactionType_transfer' }
			},
			{
				description: 'returns the mapped key for an ethereum transaction type',
				config: { type: EthereumTransactionType.UNISWAP_SWAP, chainName: CHAIN_NAME_ETHEREUM },
				expected: { result: 'transactionType_uniswapSwap' }
			},
			{
				description: 'returns the incoming transfer key for a symbol transfer with incoming direction',
				config: { type: SymbolTransactionType.TRANSFER, chainName: CHAIN_NAME_SYMBOL, direction: TransactionDirection.INCOMING },
				expected: { result: 'transactionType_transferIncoming' }
			},
			{
				description: 'returns the outgoing transfer key for a symbol transfer with outgoing direction',
				config: { type: SymbolTransactionType.TRANSFER, chainName: CHAIN_NAME_SYMBOL, direction: TransactionDirection.OUTGOING },
				expected: { result: 'transactionType_transferOutgoing' }
			},
			{
				description: 'returns the outgoing transfer key for an ethereum transfer with outgoing direction',
				config: {
					type: EthereumTransactionType.TRANSFER,
					chainName: CHAIN_NAME_ETHEREUM,
					direction: TransactionDirection.OUTGOING
				},
				expected: { result: 'transactionType_transferOutgoing' }
			},
			{
				description: 'returns the plain transfer key when the direction is unknown',
				config: { type: SymbolTransactionType.TRANSFER, chainName: CHAIN_NAME_SYMBOL, direction: 'sideways' },
				expected: { result: 'transactionType_transfer' }
			},
			{
				description: 'ignores the direction for a non-transfer type',
				config: { type: SymbolTransactionType.HASH_LOCK, chainName: CHAIN_NAME_SYMBOL, direction: TransactionDirection.INCOMING },
				expected: { result: 'transactionType_hashLock' }
			},
			{
				description: 'returns the unknown-type key for an unmapped type',
				config: { type: 999999, chainName: CHAIN_NAME_SYMBOL },
				expected: { result: 'transactionType_unknown' }
			},
			{
				description: 'returns the unknown-type key for an unknown chain',
				config: { type: SymbolTransactionType.TRANSFER, chainName: 'unknownChain' },
				expected: { result: 'transactionType_unknown' }
			}
		];

		getTransactionTypeLocaleKeyTests.forEach(test => {
			runGetTransactionTypeLocaleKeyTest(test.description, test.config, test.expected);
		});

		it('maps every transaction type and direction member to an existing en.json key', () => {
			// Arrange:
			const chainTypePairs = [
				...Object.values(SymbolTransactionType).map(type => ({ type, chainName: CHAIN_NAME_SYMBOL })),
				...Object.values(EthereumTransactionType).map(type => ({ type, chainName: CHAIN_NAME_ETHEREUM }))
			];

			// Act:
			const typeKeys = chainTypePairs.map(pair => getTransactionTypeLocaleKey(pair.type, pair.chainName));
			const directionKeys = Object.values(TransactionDirection).map(direction =>
				getTransactionTypeLocaleKey(SymbolTransactionType.TRANSFER, CHAIN_NAME_SYMBOL, direction));
			const unknownKeys = [...typeKeys, ...directionKeys].filter(key => !enKeys.includes(key));

			// Assert:
			expect(unknownKeys).toEqual([]);
		});
	});

	describe('getReceiptTypeLocaleKey()', () => {
		const runGetReceiptTypeLocaleKeyTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getReceiptTypeLocaleKey(config.type);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const getReceiptTypeLocaleKeyTests = [
			{
				description: 'returns the mapped key for the harvesting reward receipt type',
				config: { type: ReceiptType.HARVESTING_REWARD },
				expected: { result: 'receiptType_harvestingReward' }
			},
			{
				description: 'returns the unknown-receipt key for an unmapped type',
				config: { type: 'unknownReceiptType' },
				expected: { result: 'receiptType_unknown' }
			},
			{
				description: 'returns the unknown-receipt key when the type is undefined',
				config: { type: undefined },
				expected: { result: 'receiptType_unknown' }
			}
		];

		getReceiptTypeLocaleKeyTests.forEach(test => {
			runGetReceiptTypeLocaleKeyTest(test.description, test.config, test.expected);
		});

		it('maps every ReceiptType member to an existing en.json key', () => {
			// Act:
			const unknownKeys = Object.values(ReceiptType)
				.map(getReceiptTypeLocaleKey)
				.filter(key => !enKeys.includes(key));

			// Assert:
			expect(unknownKeys).toEqual([]);
		});
	});
});
