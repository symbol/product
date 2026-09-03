import { TokenRow } from '@/app/components/display/Token/TokenRow';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { runRenderTextTest } from '__tests__/component-tests';

// Token Fixtures

const token = TokenFixtureBuilder
	.createWithToken('symbol', 'testnet', 0)
	.build();

describe('components/display/Token/TokenRow', () => {
	describe('with a resolved name', () => {
		runRenderTextTest(TokenRow, {
			props: {
				tokenId: token.id,
				name: token.name
			},
			textToRender: [
				{ type: 'text', value: token.name },
				{ type: 'text', value: token.id }
			]
		});
	});

	describe('without a name', () => {
		runRenderTextTest(TokenRow, {
			props: { tokenId: token.id },
			textToRender: [
				{ type: 'text', value: token.id }
			]
		});
	});
});
