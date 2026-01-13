import { Home } from '@/app/screens/home/Home';
import { runRenderComponentTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';

describe('screens/onboarding/Home', () => {
	beforeEach(() => {
		mockLocalization();
	});

	runRenderComponentTest(Home);
});
