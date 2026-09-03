import { TokenBalanceRow } from '@/app/components/display/Token/TokenBalanceRow';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { runRenderTextTest } from '__tests__/component-tests';
import { Text } from 'react-native';

// Token Fixtures

const token = TokenFixtureBuilder
	.createWithToken('symbol', 'testnet', 0)
	.setAmount('1000')
	.build();

// Constants

const TICKER = 'XYM';
const DISPLAY_NAME = `${token.name} • ${TICKER}`;
const ACCESSORY_TEXT = 'accessory';
const AMOUNT_PLACEHOLDER = '..';

describe('components/display/Token/TokenBalanceRow', () => {
	describe('with a name, ticker and amount', () => {
		runRenderTextTest(TokenBalanceRow, {
			props: {
				name: token.name,
				ticker: TICKER,
				amount: token.amount
			},
			textToRender: [
				{ type: 'text', value: DISPLAY_NAME },
				{ type: 'text', value: token.amount }
			]
		});
	});

	describe('without an amount', () => {
		runRenderTextTest(TokenBalanceRow, {
			props: {
				name: token.name,
				ticker: TICKER
			},
			textToRender: [
				{ type: 'text', value: DISPLAY_NAME }
			],
			textToHide: [
				{ type: 'text', value: token.amount }
			]
		});
	});

	describe('with a null amount', () => {
		runRenderTextTest(TokenBalanceRow, {
			props: {
				name: token.name,
				ticker: TICKER,
				amount: null
			},
			textToRender: [
				{ type: 'text', value: DISPLAY_NAME },
				{ type: 'text', value: AMOUNT_PLACEHOLDER }
			],
			textToHide: [
				{ type: 'text', value: token.amount }
			]
		});
	});

	describe('with an accessory', () => {
		runRenderTextTest(TokenBalanceRow, {
			props: {
				name: token.name,
				ticker: TICKER,
				accessory: <Text>{ACCESSORY_TEXT}</Text>
			},
			textToRender: [
				{ type: 'text', value: DISPLAY_NAME },
				{ type: 'text', value: ACCESSORY_TEXT }
			]
		});
	});

	describe('with a title caption', () => {
		runRenderTextTest(TokenBalanceRow, {
			props: {
				name: token.name,
				ticker: TICKER,
				titleCaption: <Text>caption</Text>
			},
			textToRender: [
				{ type: 'text', value: DISPLAY_NAME },
				{ type: 'text', value: 'caption' }
			]
		});
	});

	describe('with children below the amount', () => {
		runRenderTextTest(TokenBalanceRow, {
			props: {
				name: token.name,
				ticker: TICKER,
				amount: token.amount,
				children: <Text>extra</Text>
			},
			textToRender: [
				{ type: 'text', value: DISPLAY_NAME },
				{ type: 'text', value: 'extra' }
			]
		});
	});
});
