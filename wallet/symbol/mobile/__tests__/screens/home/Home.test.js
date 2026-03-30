import { Home } from '@/app/screens/home/Home';
import { runRenderComponentTest } from '__tests__/component-tests';
import { mockLocalization, mockWalletController } from '__tests__/mock-helpers';

describe('screens/onboarding/Home', () => {
	beforeEach(() => {
		mockLocalization();
		mockWalletController({
			modules: {
				multisig: {
					multisigAccounts: [],
					fetchData: jest.fn().mockResolvedValue([])
				},
				addressBook: {
					whiteList: [],
					contacts: [],
					blackList: [],
					getContactByAddress: jest.fn().mockReturnValue(null)
				},
				market: {
					price: null
				}
			}
		});
	});

	runRenderComponentTest(Home);
});
