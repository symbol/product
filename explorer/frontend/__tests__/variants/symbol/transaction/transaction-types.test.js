import { runTestCases } from '../../../test-utils/page';
import { TRANSACTION_TYPE, getTransactionTypeInfo } from '@/app/variants/symbol/transaction/transaction-types';

describe('variants/symbol/transaction/transaction-types', () => {
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
				description: 'returns the type info when the type is address alias',
				config: { type: TRANSACTION_TYPE.ADDRESS_ALIAS },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_addressAlias',
						icon: 'namespace'
					}
				}
			},
			{
				description: 'returns the type info when the type is mosaic alias',
				config: { type: TRANSACTION_TYPE.MOSAIC_ALIAS },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_mosaicAlias',
						icon: 'namespace'
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
						icon: 'mosaic'
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
				description: 'returns the type info when the type is mosaic supply revocation',
				config: { type: TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_mosaicSupplyRevocation',
						icon: 'revert'
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
						icon: 'multisig'
					}
				}
			},
			{
				description: 'returns the type info when the type is aggregate complete',
				config: { type: TRANSACTION_TYPE.AGGREGATE_COMPLETE },
				expected: {
					info: {
						kind: 'aggregate',
						localeKey: 'transactionType_aggregateComplete',
						icon: 'aggregate'
					}
				}
			},
			{
				description: 'returns the type info when the type is aggregate bonded',
				config: { type: TRANSACTION_TYPE.AGGREGATE_BONDED },
				expected: {
					info: {
						kind: 'aggregate',
						localeKey: 'transactionType_aggregateBonded',
						icon: 'aggregate'
					}
				}
			},
			{
				description: 'returns the type info when the type is hash lock',
				config: { type: TRANSACTION_TYPE.HASH_LOCK },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_hashLock',
						icon: 'lock'
					}
				}
			},
			{
				description: 'returns the type info when the type is secret lock',
				config: { type: TRANSACTION_TYPE.SECRET_LOCK },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_secretLock',
						icon: 'lock'
					}
				}
			},
			{
				description: 'returns the type info when the type is secret proof',
				config: { type: TRANSACTION_TYPE.SECRET_PROOF },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_secretProof',
						icon: 'lock'
					}
				}
			},
			{
				description: 'returns the type info when the type is account address restriction',
				config: { type: TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_accountAddressRestriction',
						icon: 'restriction'
					}
				}
			},
			{
				description: 'returns the type info when the type is account mosaic restriction',
				config: { type: TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_accountMosaicRestriction',
						icon: 'restriction'
					}
				}
			},
			{
				description: 'returns the type info when the type is account operation restriction',
				config: { type: TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_accountOperationRestriction',
						icon: 'restriction'
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
				description: 'returns the type info when the type is mosaic address restriction',
				config: { type: TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_mosaicAddressRestriction',
						icon: 'restriction'
					}
				}
			},
			{
				description: 'returns the type info when the type is mosaic global restriction',
				config: { type: TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_mosaicGlobalRestriction',
						icon: 'restriction'
					}
				}
			},
			{
				description: 'returns the type info when the type is account metadata',
				config: { type: TRANSACTION_TYPE.ACCOUNT_METADATA },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_accountMetadata',
						icon: 'metadata'
					}
				}
			},
			{
				description: 'returns the type info when the type is mosaic metadata',
				config: { type: TRANSACTION_TYPE.MOSAIC_METADATA },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_mosaicMetadata',
						icon: 'metadata'
					}
				}
			},
			{
				description: 'returns the type info when the type is namespace metadata',
				config: { type: TRANSACTION_TYPE.NAMESPACE_METADATA },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_namespaceMetadata',
						icon: 'metadata'
					}
				}
			},
			{
				description: 'returns the type info when the type is vrf key link',
				config: { type: TRANSACTION_TYPE.VRF_KEY_LINK },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_vrfKeyLink',
						icon: 'key'
					}
				}
			},
			{
				description: 'returns the type info when the type is voting key link',
				config: { type: TRANSACTION_TYPE.VOTING_KEY_LINK },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_votingKeyLink',
						icon: 'key'
					}
				}
			},
			{
				description: 'returns the type info when the type is node key link',
				config: { type: TRANSACTION_TYPE.NODE_KEY_LINK },
				expected: {
					info: {
						kind: 'other',
						localeKey: 'transactionType_nodeKeyLink',
						icon: 'key'
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
