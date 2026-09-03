import { TokenInfoCard } from '@/app/components/display/Token/TokenInfoCard';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { runRenderTextTest } from '__tests__/component-tests';
import { Text } from 'react-native';

// Token Fixtures

const token = TokenFixtureBuilder
	.createWithToken('symbol', 'testnet', 0)
	.build();

describe('components/display/Token/TokenInfoCard', () => {
	describe('with a name', () => {
		runRenderTextTest(TokenInfoCard, {
			props: { name: token.name },
			textToRender: [
				{ type: 'text', value: token.name }
			]
		});
	});

	describe('with children below the divider', () => {
		runRenderTextTest(TokenInfoCard, {
			props: {
				name: token.name,
				children: <Text>extra field</Text>
			},
			textToRender: [
				{ type: 'text', value: token.name },
				{ type: 'text', value: 'extra field' }
			]
		});
	});
});
