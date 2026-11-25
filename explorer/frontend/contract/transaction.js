/** @typedef {import('@/contract/types/Contract').RequiredModuleExports} RequiredModuleExports */

/**
 * Required list of transaction modules expected for each variant.
 * @type {RequiredModuleExports[]}
 */
export const requiredTransactionModules = [
	{
		path: 'transaction/transaction-types',
		exportNames: ['TRANSACTION_TYPE', 'getTransactionTypeInfo']
	}
];
