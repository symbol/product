import { Welcome } from '@/app/screens/onboarding/Welcome';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';
import { runScreenNavigationTest } from '__tests__/screen-tests';

jest.mock('@/app/config', () => ({
	...jest.requireActual('@/app/config'),
	termsAndPrivacy: {
		terms: 'Terms content',
		privacy: 'Privacy content'
	}
}));

describe('screens/onboarding/Welcome', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockLocalization();
	});

	runRenderTextTest(Welcome, {
		textToRender: [
			{ type: 'text', value: 's_welcome_wallet_title' },
			{ type: 'text', value: 'button_walletCreate' },
			{ type: 'text', value: 'button_walletImport' },
			{ type: 'text', value: 's_welcome_modal_title' },
			{ type: 'text', value: 's_welcome_modal_tnc' },
			{ type: 'text', value: 's_welcome_modal_privacy' },
			{ type: 'text', value: 'Terms content' },
			{ type: 'text', value: 'Privacy content' }
		]
	});

	runScreenNavigationTest(Welcome, {
		navigationActions: [
			{
				buttonText: 'button_walletCreate',
				actionName: 'goToCreateWallet'
			},
			{
				buttonText: 'button_walletImport',
				actionName: 'goToImportWallet'
			}
		]
	});
});
