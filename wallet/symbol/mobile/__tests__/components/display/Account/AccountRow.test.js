import { AccountRow } from '@/app/components/display/Account/AccountRow';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { runRenderTextTest } from '__tests__/component-tests';

// Account Fixtures

const account = AccountFixtureBuilder
	.createWithAccount('symbol', 'testnet', 0)
	.build();

describe('components/display/Account/AccountRow', () => {
	describe('with a resolved name', () => {
		runRenderTextTest(AccountRow, {
			props: {
				address: account.address,
				name: account.name
			},
			textToRender: [
				{ type: 'text', value: account.name },
				{ type: 'text', value: account.address }
			]
		});
	});

	describe('without a name', () => {
		runRenderTextTest(AccountRow, {
			props: { address: account.address },
			textToRender: [
				{ type: 'text', value: account.address }
			]
		});
	});
});
