/**
 * @typedef {object} RequiredAssetFolder
 * @property {string} folder - Folder path inside the variant public folder.
 * @property {string[]} names - Image file names array (with extension).
 */

const STATUS_ICON_NAMES = [
	'icon-label-confirmed.svg',
	'icon-label-false.svg',
	'icon-label-harvesting.svg',
	'icon-label-multisig.svg',
	'icon-label-pending.svg',
	'icon-label-true.svg'
];

/**
 * Required list of image files expected for each variant.
 * @type {RequiredAssetFolder[]}
 */
export const requiredAssets = [
	{
		folder: 'images',
		names: [
			'icon-account-add.png',
			'icon-account.svg',
			'icon-chain-pending.svg',
			'icon-chain.svg',
			'icon-chip-clear.png',
			'icon-circle-more.png',
			'icon-close.svg',
			'icon-copy.png',
			'icon-delete.png',
			'icon-mosaic-custom.svg',
			'icon-mosaic-native.svg',
			'icon-profile.svg',
			'icon-question.svg',
			'icon-search.svg',
			'icon-switch-2.svg',
			'icon-switch.svg',
			'icon-transaction-direction.svg',
			'icon-transaction-header-block.svg',
			'logo-outline.svg',
			'logo.png',
			'transaction-arrow.svg'
		]
	},
	{
		folder: 'images/blocks',
		names: ['block.svg']
	},
	{
		folder: 'images/menu',
		names: [
			'accounts.svg',
			'blocks.svg',
			'home.svg',
			'mosaics.svg',
			'namespaces.svg',
			'nodes.svg',
			'transactions.svg'
		]
	},
	{
		folder: 'images/mosaics',
		names: [
			'currency.png',
			'custom.png'
		]
	},
	{
		folder: 'images/namespaces',
		names: ['namespace.svg']
	},
	{
		folder: 'images/nodes',
		names: ['node.svg']
	},
	{
		folder: 'images/social',
		names: [
			'discord.svg',
			'github.svg',
			'twitter.svg'
		]
	},
	{
		folder: 'images/status/body',
		names: STATUS_ICON_NAMES
	},
	{
		folder: 'images/status/link',
		names: STATUS_ICON_NAMES
	},
	{
		folder: 'images/status/semantic',
		names: STATUS_ICON_NAMES
	},
	{
		folder: 'images/transaction',
		names: ['default.svg']
	}
];
