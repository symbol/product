/** @typedef {import('@/contract/types/Contract').RequiredModuleExports} RequiredModuleExports */

/**
 * Required list of utils modules expected for each variant.
 * @type {RequiredModuleExports[]}
 */
export const requiredUtilsModules = [
	{
		path: 'utils/blocks',
		exportNames: ['getBlockStatus']
	},
	{
		path: 'utils/transactions',
		exportNames: ['isTransactionAwaitingSignatures']
	}
];
