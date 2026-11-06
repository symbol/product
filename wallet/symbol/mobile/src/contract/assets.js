/**
 * @typedef {object} RequiredAssetFolder
 * @property {string} folder - Folder path.
 * @property {string[]} names - Image file names array (without extension).
 */

/**
 * Required list of image files expected for each brand.
 * @type {RequiredAssetFolder[]}
 */
export const requiredAssets = [
	{
		folder: 'assets/images/navigation',
		names: [
			'assets-active',
			'assets-default',
			'features-active',
			'features-default',
			'history-active',
			'history-default',
			'home-active',
			'home-default',
			'scan-active',
			'scan-default'
		]
	},
	{
		folder: 'assets/images/transactions',
		names: [
			'aggregate',
			'default',
			'key',
			'lock',
			'metadata',
			'multisig',
			'namespace',
			'restriction',
			'revert',
			'reward',
			'swap',
			'token',
			'transfer'
		]
	},
	{
		folder: 'assets/images/logos',
		names: ['app-logo']
	},
	{
		folder: 'assets/images/tokens',
		names: [
			'default-large', 
			'default-medium', 
			'default-small'
		]
	}
];
