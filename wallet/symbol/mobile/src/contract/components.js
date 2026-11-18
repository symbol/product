/** @typedef {import('@/contract/types/Contract').RequiredModule} RequiredModule */

/**
 * Required list of components expected for each brand.
 * @type {RequiredModule[]}
 */
export const requiredComponents = [
	{ 
		path: 'screens/home/components/AccountCardWidget', 
		exportName: 'AccountCardWidget', 
		typeName: 'AccountCardWidgetProps' 
	},
	{ 
		path: 'screens/onboarding/components/WelcomeView', 
		exportName: 'WelcomeView', 
		typeName: 'WelcomeViewProps' 
	},
	{
		path: 'screens/onboarding/components/WalletCreationAnimation',
		exportName: 'WalletCreationAnimation',
		typeName: 'WalletCreationAnimationProps'
	}
];
