import { AccountInfoCard } from '@/app/components/display/Account/AccountInfoCard';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';
import { Text } from 'react-native';

// Constants

const CHAIN_NAME = 'symbol';
const NOTES = 'Some notes';

// Account Fixtures

const account = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, 'testnet', 0)
	.build();

describe('components/display/Account/AccountInfoCard', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('with a name and an address', () => {
		runRenderTextTest(AccountInfoCard, {
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

	describe('with a chain name and notes', () => {
		runRenderTextTest(AccountInfoCard, {
			props: {
				address: account.address,
				name: account.name,
				chainName: CHAIN_NAME,
				notes: NOTES
			},
			textToRender: [
				{ type: 'text', value: CHAIN_NAME },
				{ type: 'text', value: NOTES }
			]
		});
	});

	describe('with children above the divider', () => {
		runRenderTextTest(AccountInfoCard, {
			props: {
				address: account.address,
				name: account.name,
				children: <Text>extra field</Text>
			},
			textToRender: [
				{ type: 'text', value: account.name },
				{ type: 'text', value: 'extra field' }
			]
		});
	});
});
