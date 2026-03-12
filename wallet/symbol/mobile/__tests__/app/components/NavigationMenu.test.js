import { NavigationMenu } from '@/app/app/components';
import { mockLocalization } from '__tests__/mock-helpers';
import { runScreenNavigationTest } from '__tests__/screen-tests';

describe('components/NavigationMenu', () => {
	beforeEach(() => {
		mockLocalization();
	});

	runScreenNavigationTest(NavigationMenu, {
		navigationActions: [
			{
				buttonText: 'navigation_home',
				actionName: 'goToHome'
			},
			{
				buttonText: 'navigation_history',
				actionName: 'goToHistory'
			}
		]
	});
});
