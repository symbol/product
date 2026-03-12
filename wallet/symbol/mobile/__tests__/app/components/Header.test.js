import { Header } from '@/app/app/components';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { mockLocalization } from '__tests__/mock-helpers';
import { runScreenNavigationTest } from '__tests__/screen-tests';

const currentAccount = AccountFixtureBuilder
	.createWithAccount('symbol', 'testnet', 0)
	.build();

describe('components/Header', () => {
	beforeEach(() => {
		mockLocalization();
	});

	runScreenNavigationTest(Header, {
		props: { currentAccount },
		navigationActions: [
			{
				buttonText: currentAccount.name,
				actionName: 'goToAccountList'
			}
		]
	});
});
