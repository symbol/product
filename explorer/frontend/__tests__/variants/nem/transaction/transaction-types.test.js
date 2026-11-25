import { runTestCases } from '../../../test-utils/page';
import { TRANSACTION_TYPE, getTransactionTypeInfo } from '@/app/variants/nem/transaction/transaction-types';

describe('variants/nem/transaction/transaction-types', () => {
	describe('getTransactionTypeInfo', () => {
		const runGetTransactionTypeInfoTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getTransactionTypeInfo(config.type);

				// Assert:
				expect(result).toStrictEqual(expected.info);
			});
		};

		const getTransactionTypeInfoCases = [
			{
				description: 'returns the type info when the type is transfer',
				config: { type: TRANSACTION_TYPE.TRANSFER },
				expected: {
					info: {
						kind: 'transfer',
						localeKey: 'transactionType_transfer',
						icon: 'transfer'
					}
				}
			},
			{
				description: 'returns the type info when the type is mosaic definition',
				config: { type: TRANSACTION_TYPE.MOSAIC_DEFINITION },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_mosaicDefinition',
						icon: 'mosaic-creation'
					}
				}
			},
			{
				description: 'returns the type info when the type is mosaic supply change',
				config: { type: TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_mosaicSupplyChange',
						icon: 'mosaic'
					}
				}
			},
			{
				description: 'returns the type info when the type is namespace registration',
				config: { type: TRANSACTION_TYPE.NAMESPACE_REGISTRATION },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_namespaceRegistration',
						icon: 'namespace'
					}
				}
			},
			{
				description: 'returns the type info when the type is multisig account modification',
				config: { type: TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_multisigAccountModification',
						icon: 'account-multisig'
					}
				}
			},
			{
				description: 'returns the type info when the type is account key link',
				config: { type: TRANSACTION_TYPE.ACCOUNT_KEY_LINK },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_accountKeyLink',
						icon: 'key'
					}
				}
			},
			{
				description: 'returns the type info when the type is multisig',
				config: { type: TRANSACTION_TYPE.MULTISIG },
				expected: {
					info: {
						kind: 'aggregate',
						localeKey: 'transactionType_multisig',
						icon: 'aggregate'
					}
				}
			},
			{
				description: 'returns the unknown type info when the type is not known',
				config: { type: 'NOT_A_TYPE' },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_unknown',
						icon: 'default'
					}
				}
			}
		];

		runTestCases(runGetTransactionTypeInfoTest, getTransactionTypeInfoCases);
	});
});
