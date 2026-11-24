/** @typedef {import('@/contract/types/Contract').RequiredModule} RequiredModule */

/**
 * Required list of configs expected for each variant.
 * @type {RequiredModule[]}
 */
export const requiredConfigs = [
	{
		path: 'config/account-info-page-config',
		exportName: 'accountInfoPageConfig',
		typeName: 'AccountInfoPageConfig'
	},
	{
		path: 'config/block-list-page-config',
		exportName: 'blockListPageConfig',
		typeName: 'BlockListPageConfig'
	},
	{
		path: 'config/home-page-config',
		exportName: 'homePageConfig',
		typeName: 'HomePageConfig'
	}
];
