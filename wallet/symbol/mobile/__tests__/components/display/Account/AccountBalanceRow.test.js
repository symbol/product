import { AccountBalanceRow } from '@/app/components/display/Account/AccountBalanceRow';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { runRenderTextTest } from '__tests__/component-tests';
import { Text } from 'react-native';

// Account Fixtures

const account = AccountFixtureBuilder
	.createWithAccount('symbol', 'testnet', 0)
	.build();

// Constants

const AMOUNT = '1000';
const TICKER = 'XYM';
const ACCESSORY_TEXT = 'accessory';

describe('components/display/Account/AccountBalanceRow', () => {
	describe('with a name and a balance', () => {
		runRenderTextTest(AccountBalanceRow, {
			props: {
				address: account.address,
				name: account.name,
				amount: AMOUNT,
				ticker: TICKER
			},
			textToRender: [
				{ type: 'text', value: account.name },
				{ type: 'text', value: account.address },
				{ type: 'text', value: AMOUNT },
				{ type: 'text', value: TICKER }
			]
		});
	});

	describe('without a name', () => {
		runRenderTextTest(AccountBalanceRow, {
			props: { address: account.address },
			textToRender: [
				{ type: 'text', value: account.address }
			]
		});
	});

	describe('without an amount', () => {
		runRenderTextTest(AccountBalanceRow, {
			props: {
				address: account.address,
				name: account.name,
				ticker: TICKER
			},
			textToRender: [
				{ type: 'text', value: account.name }
			],
			textToHide: [
				{ type: 'text', value: TICKER }
			]
		});
	});

	describe('with several amounts', () => {
		runRenderTextTest(AccountBalanceRow, {
			props: {
				address: account.address,
				name: account.name,
				amounts: [
					{ value: '10' },
					{ value: '20' }
				]
			},
			textToRender: [
				{ type: 'text', value: '10' },
				{ type: 'text', value: '20' }
			]
		});
	});

	describe('with an accessory', () => {
		runRenderTextTest(AccountBalanceRow, {
			props: {
				address: account.address,
				accessory: <Text>{ACCESSORY_TEXT}</Text>
			},
			textToRender: [
				{ type: 'text', value: ACCESSORY_TEXT }
			]
		});
	});

	describe('with size "l"', () => {
		runRenderTextTest(AccountBalanceRow, {
			props: {
				address: account.address,
				name: account.name,
				amount: AMOUNT,
				ticker: TICKER,
				size: 'l'
			},
			textToRender: [
				{ type: 'text', value: account.name },
				{ type: 'text', value: account.address },
				{ type: 'text', value: AMOUNT },
				{ type: 'text', value: TICKER }
			]
		});
	});
});
