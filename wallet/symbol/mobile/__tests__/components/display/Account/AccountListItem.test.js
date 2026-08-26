import { AccountListItem } from '@/app/components/display/Account/AccountListItem';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { runPressTest, runRenderTextTest } from '__tests__/component-tests';

// Account Fixtures

const account = AccountFixtureBuilder
	.createWithAccount('symbol', 'testnet', 0)
	.build();

// Constants

const AMOUNT = '1000';
const TICKER = 'XYM';
const ACCESSIBILITY_LABEL = 'account-item';

// Props

const createDefaultProps = () => ({
	address: account.address,
	name: account.name,
	amount: AMOUNT,
	ticker: TICKER,
	accessibilityLabel: ACCESSIBILITY_LABEL
});

describe('components/display/Account/AccountListItem', () => {
	runRenderTextTest(AccountListItem, {
		props: createDefaultProps(),
		textToRender: [
			{ type: 'text', value: account.name },
			{ type: 'text', value: account.address },
			{ type: 'text', value: AMOUNT },
			{ type: 'text', value: TICKER }
		]
	});

	runPressTest(AccountListItem, {
		props: createDefaultProps(),
		labelToPress: ACCESSIBILITY_LABEL
	});
});
